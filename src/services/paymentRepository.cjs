const { v4: uuid } = require('uuid')
const core = require('./paymentCore.mjs')

// Shared by the JS runtime and the legacy TS adapter. All transaction callbacks
// are synchronous; no await may escape an SQLite transaction.
class PaymentRepository {
  validatePaymentAmounts(...args) { return core.validatePaymentAmounts(...args) }
  getPaymentStatusFromBalance(...args) { return core.paymentStatus(...args) }

  getLinkedPaymentTotal(column, id, excludeId = null) {
    if (!['appointment_id', 'tooth_treatment_id'].includes(column)) throw new Error('Invalid payment link column')
    return core.sumPayments(this.db.prepare(`SELECT * FROM payments WHERE ${column} = ? ${column === 'appointment_id' ? 'AND tooth_treatment_id IS NULL' : ''} AND id != ?`).all(id, excludeId || ''))
  }

  // An additive request journal, populated only for newly submitted operations.
  withFinancialRequest(requestId, payload, action) {
    if (!requestId) return action()
    if (typeof requestId !== 'string' || requestId.length > 128) throw new Error('Invalid financial request ID')
    this.db.exec('CREATE TABLE IF NOT EXISTS financial_requests (request_id TEXT PRIMARY KEY, payload TEXT NOT NULL, result TEXT NOT NULL)')
    const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().filter(k=>value[k] !== undefined).map(k=>[k,stable(value[k])])) : value
    const serialized = JSON.stringify(stable(payload))
    const previous = this.db.prepare('SELECT * FROM financial_requests WHERE request_id = ?').get(requestId)
    if (previous) {
      if (previous.payload !== serialized) throw new Error('Financial request ID already used with different data')
      return JSON.parse(previous.result)
    }
    const result = action()
    this.db.prepare('INSERT INTO financial_requests VALUES (?, ?, ?)').run(requestId, serialized, JSON.stringify(result))
    return result
  }

  validatePaymentRecord(payment) {
    core.validatePaymentAmounts(payment.amount, payment.discount_amount ?? 0, payment.tax_amount ?? 0)
    if (!payment.patient_id || !this.db.prepare('SELECT id FROM patients WHERE id = ?').get(payment.patient_id)) throw new Error('يرجى اختيار مريض صالح')
    if (!['cash', 'bank_transfer'].includes(payment.payment_method)) throw new Error('طريقة الدفع غير صالحة')
    if (!payment.payment_date || !Number.isFinite(Date.parse(payment.payment_date))) throw new Error('تاريخ الدفع غير صالح')
    if (!['completed','partial','paid','pending','failed','refunded','cancelled','overdue'].includes(payment.status || 'completed')) throw new Error('حالة الدفع غير صالحة')
    if (payment.amount === 0 && payment.status !== 'pending') throw new Error('يجب أن يكون مبلغ الدفعة أكبر من صفر')
    if (payment.tooth_treatment_id && payment.appointment_id) throw new Error('اربط الدفعة بعلاج أو موعد واحد فقط')
    for (const [key, table] of [['tooth_treatment_id','tooth_treatments'], ['appointment_id','appointments']]) {
      if (payment[key]) {
        const linked = this.db.prepare(`SELECT patient_id FROM ${table} WHERE id = ?`).get(payment[key])
        if (!linked || linked.patient_id !== payment.patient_id) throw new Error('العلاج أو الموعد لا يخص المريض المحدد')
      }
    }
  }

  paymentFields(payment, excludeId = null) {
    this.validatePaymentRecord(payment)
    const total = core.finalAmount(payment.amount, payment.discount_amount ?? 0, payment.tax_amount ?? 0)
    const active = core.isRevenuePaymentStatus(payment.status || 'completed')
    // Preserve zero pending placeholders; a positive newly submitted payment is a receipt.
    const paid = active && payment.amount > 0 ? total : 0
    if (active && total <= 0) throw new Error('يجب أن يكون صافي مبلغ الدفعة أكبر من صفر')
    const fields = {
      total_amount: total, appointment_total_cost:null, appointment_total_paid:null, appointment_remaining_balance:null,
      treatment_total_cost:null, treatment_total_paid:null, treatment_remaining_balance:null
    }
    let cost = payment.total_amount_due ?? total
    let totalPaid = paid
    let kind = null
    if (payment.tooth_treatment_id || payment.appointment_id) {
      kind = payment.tooth_treatment_id ? 'treatment' : 'appointment'
      const table = kind === 'treatment' ? 'tooth_treatments' : 'appointments'
      const column = kind === 'treatment' ? 'tooth_treatment_id' : 'appointment_id'
      cost = this.db.prepare(`SELECT cost FROM ${table} WHERE id = ?`).get(payment[column]).cost ?? 0
      const previous = this.getLinkedPaymentTotal(column, payment[column], excludeId)
      if (core.cents(paid) > core.cents(core.balance(cost, previous))) throw new Error(`Payment amount exceeds remaining ${kind} balance (${core.balance(cost, previous)})`)
      totalPaid = core.money(previous + paid)
      fields[`${kind}_total_cost`] = core.money(cost)
      fields[`${kind}_total_paid`] = totalPaid
      fields[`${kind}_remaining_balance`] = core.balance(cost, totalPaid)
    }
    core.validatePaymentAmounts(cost)
    if (!kind && core.cents(paid) > core.cents(cost)) throw new Error('Paid amount exceeds total amount due')
    return { ...fields, total_amount_due:core.money(cost), amount_paid:totalPaid, remaining_balance:core.balance(cost,totalPaid),
      status:active ? (payment.amount === 0 ? 'pending' : core.paymentStatus(cost,totalPaid)) : payment.status }
  }

  createPaymentSync(payment) {
    const fields = this.paymentFields(payment)
    const now = new Date().toISOString()
    const record = {
      id:uuid(), patient_id:payment.patient_id, tooth_treatment_id:payment.tooth_treatment_id || null,
      appointment_id:payment.appointment_id || null, amount:payment.amount, payment_method:payment.payment_method,
      payment_date:payment.payment_date, description:payment.description ?? null, receipt_number:payment.receipt_number ?? null,
      notes:payment.notes ?? null, discount_amount:payment.discount_amount ?? 0, tax_amount:payment.tax_amount ?? 0,
      ...fields, is_comprehensive:payment.is_comprehensive ? 1 : 0, comprehensive_batch_id:payment.comprehensive_batch_id ?? null,
      created_at:now, updated_at:now
    }
    const columns = Object.keys(record)
    this.db.prepare(`INSERT INTO payments (${columns.join(',')}) VALUES (${columns.map(c=>'@'+c).join(',')})`).run(record)
    return record
  }

  async createPayment(payment) {
    this.ensurePaymentsColumns()
    return this.db.transaction(() => this.withFinancialRequest(payment.request_id, payment, () => this.createPaymentSync(payment))).immediate()
  }

  async updatePayment(id, updates) {
    this.ensurePaymentsColumns()
    return this.db.transaction(() => {
      const current = this.db.prepare('SELECT * FROM payments WHERE id = ?').get(id)
      if (!current) throw new Error('Payment not found')
      if (updates.patient_id && updates.patient_id !== current.patient_id) throw new Error('لا يمكن نقل دفعة إلى مريض آخر')
      const allowed = ['amount','discount_amount','tax_amount','payment_method','payment_date','description','receipt_number','notes','status','tooth_treatment_id','appointment_id','total_amount_due']
      const changes = Object.fromEntries(Object.entries(updates).filter(([key,value]) => allowed.includes(key) && value !== undefined))
      const next = {...current,...changes}
      if (next.tooth_treatment_id) { next.appointment_id = null; changes.appointment_id = null }
      const fields = this.paymentFields(next,id)
      const record = {...changes,...fields, updated_at:new Date().toISOString()}
      this.db.prepare(`UPDATE payments SET ${Object.keys(record).map(c=>`${c} = @${c}`).join(',')} WHERE id = @id`).run({...record,id})
      return this.db.prepare('SELECT * FROM payments WHERE id = ?').get(id)
    }).immediate()
  }

  async deletePayment(id) {
    return this.db.transaction(() => {
      const current = this.db.prepare('SELECT * FROM payments WHERE id = ?').get(id)
      if (!current) return false
      // Preserve the existing explicit whole-batch delete action.
      if (current.is_comprehensive && current.comprehensive_batch_id) {
        return this.db.prepare('DELETE FROM payments WHERE comprehensive_batch_id = ?').run(current.comprehensive_batch_id).changes > 0
      }
      return this.db.prepare('DELETE FROM payments WHERE id = ?').run(id).changes > 0
    }).immediate()
  }

  // Compatibility entry points now return live projections without rewriting history.
  updateAppointmentPaymentCalculationsSync(id) { return this.getLinkedPaymentTotal('appointment_id',id) }
  updateToothTreatmentPaymentCalculationsSync(id) { return this.getLinkedPaymentTotal('tooth_treatment_id',id) }

  projectPayment(payment) {
    const kind = payment.tooth_treatment_id ? 'treatment' : payment.appointment_id ? 'appointment' : null
    if (!kind) return payment
    const table = kind === 'treatment' ? 'tooth_treatments' : 'appointments'
    const column = kind === 'treatment' ? 'tooth_treatment_id' : 'appointment_id'
    const linked = this.db.prepare(`SELECT cost FROM ${table} WHERE id = ?`).get(payment[column])
    if (!linked) return payment
    const totalPaid = this.getLinkedPaymentTotal(column,payment[column])
    const cost = core.money(linked.cost ?? 0)
    const remaining = core.balance(cost,totalPaid)
    return {...payment, [`${kind}_total_cost`]:cost, [`${kind}_total_paid`]:totalPaid, [`${kind}_remaining_balance`]:remaining,
      total_amount_due:cost, amount_paid:totalPaid, remaining_balance:remaining}
  }

  async getToothTreatmentPaymentSummary(id) {
    const treatment = this.db.prepare('SELECT cost FROM tooth_treatments WHERE id = ?').get(id)
    const payments = this.db.prepare('SELECT * FROM payments WHERE tooth_treatment_id = ? ORDER BY payment_date, created_at, id').all(id)
    const totalPaid = core.sumPayments(payments)
    const treatmentCost = core.money(treatment?.cost ?? 0)
    return {treatmentCost,totalPaid,remainingBalance:core.balance(treatmentCost,totalPaid),paymentCount:payments.length,status:core.paymentStatus(treatmentCost,totalPaid),payments}
  }

  async getAppointmentPaymentSummary(id) {
    const appointment = this.db.prepare('SELECT cost FROM appointments WHERE id = ?').get(id)
    const payments = this.db.prepare('SELECT * FROM payments WHERE appointment_id = ? AND tooth_treatment_id IS NULL ORDER BY payment_date, created_at, id').all(id)
    const appointmentCost = core.money(appointment?.cost ?? 0), totalPaid = core.sumPayments(payments)
    return {appointmentCost,totalPaid,remainingBalance:core.balance(appointmentCost,totalPaid),paymentCount:payments.length,status:core.paymentStatus(appointmentCost,totalPaid),payments}
  }

  async getRemainingBalancePatients() {
    const payments = await this.getAllPayments()
    const groups = new Map()
    for (const payment of payments) {
      const key = payment.tooth_treatment_id ? 't:'+payment.tooth_treatment_id : payment.appointment_id ? 'a:'+payment.appointment_id : 'p:'+payment.id
      const group = groups.get(key) || []
      group.push(payment)
      groups.set(key,group)
    }
    const rows = []
    for (const group of groups.values()) {
      const first = group[0]
      const cost = first.treatment_total_cost ?? first.appointment_total_cost ?? first.total_amount_due ?? core.getTransactionAmount(first)
      const paid = core.sumPayments(group), remaining = core.balance(cost,paid)
      if (remaining <= 0) continue
      const installments = group.flatMap(p=>this.db.prepare("SELECT * FROM installment_payments WHERE payment_id = ? AND status != 'paid' ORDER BY due_date").all(p.id))
        .sort((a,b)=>a.due_date.localeCompare(b.due_date))
      rows.push({patient_id:first.patient_id,patient_name:first.patient?.full_name || first.patient_full_name,
        reference_id:installments[0]?.id || first.id,treatment_name:first.tooth_treatment?.treatment_type || first.appointment?.title || 'دفعة متبقية',
        total_amount:core.money(cost),amount_paid:paid,remaining_balance:remaining,status:installments[0]?.status || core.paymentStatus(cost,paid),
        next_due_date:installments[0]?.due_date || null,payment_method:first.payment_method,source_type:installments.length?'installment':'payment'})
    }
    return rows.sort((a,b)=>b.remaining_balance-a.remaining_balance)
  }

  async getUnpaidToothTreatmentsByPatient(patientId) {
    return this.db.prepare(`SELECT tt.*,a.title AS appointment_title,a.start_time AS appointment_start_time
      FROM tooth_treatments tt LEFT JOIN appointments a ON a.id=tt.appointment_id WHERE tt.patient_id = ?`).all(patientId)
      .map(t=>{const paid=this.getLinkedPaymentTotal('tooth_treatment_id',t.id);return {...t,total_paid:paid,remaining_balance:core.balance(t.cost ?? 0,paid)}})
      .filter(t=>t.remaining_balance>0).sort((a,b)=>a.remaining_balance-b.remaining_balance || a.tooth_number-b.tooth_number || a.priority-b.priority)
  }

  async updateToothTreatment(id, updates) {
    this.ensureConnection()
    this.ensureToothTreatmentsTableExists()
    return this.db.transaction(() => {
      const current = this.db.prepare('SELECT * FROM tooth_treatments WHERE id = ?').get(id)
      if (!current) throw new Error('Treatment not found')
      if (updates.patient_id && updates.patient_id !== current.patient_id && this.db.prepare('SELECT id FROM payments WHERE tooth_treatment_id = ? LIMIT 1').get(id)) throw new Error('لا يمكن نقل علاج مرتبط بدفعات إلى مريض آخر')
      if (updates.cost !== undefined) {
        core.validatePaymentAmounts(updates.cost)
        if (core.cents(updates.cost) < core.cents(this.getLinkedPaymentTotal('tooth_treatment_id',id))) throw new Error('تكلفة العلاج أقل من المبلغ المدفوع؛ راجع الدفعات أولاً')
      }
      const allowed=['patient_id','tooth_number','tooth_numbers','is_multi_tooth','tooth_name','treatment_type','treatment_category','treatment_status','treatment_color','start_date','completion_date','cost','priority','notes','appointment_id']
      const changes=Object.fromEntries(Object.entries(updates).filter(([key,value])=>allowed.includes(key) && value!==undefined))
      if (!Object.keys(changes).length) throw new Error('No valid columns to update')
      if (Array.isArray(changes.tooth_numbers)) changes.tooth_numbers=Array.from(new Set(changes.tooth_numbers.map(Number).filter(Number.isFinite))).sort((a,b)=>a-b).join(',')
      if (changes.is_multi_tooth!==undefined) changes.is_multi_tooth=changes.is_multi_tooth?1:0
      changes.updated_at=new Date().toISOString()
      this.db.prepare(`UPDATE tooth_treatments SET ${Object.keys(changes).map(k=>k+' = @'+k).join(',')} WHERE id = @id`).run({...changes,id})
      return this.db.prepare('SELECT * FROM tooth_treatments WHERE id = ?').get(id)
    }).immediate()
  }

  async createComprehensivePayment(patientId, amount, data) {
    this.ensurePaymentsColumns()
    return this.db.transaction(() => this.withFinancialRequest(data.request_id,{...data,patientId,amount},() => {
      const final = core.finalAmount(amount,data.discount_amount ?? 0,data.tax_amount ?? 0)
      if (final <= 0) throw new Error('يجب أن يكون مبلغ الدفعة أكبر من صفر')
      const treatments = this.db.prepare('SELECT * FROM tooth_treatments WHERE patient_id = ? ORDER BY id').all(patientId)
        .map(t=>({...t,paid:this.getLinkedPaymentTotal('tooth_treatment_id',t.id)}))
        .map(t=>({...t,remaining:core.balance(t.cost,t.paid)})).filter(t=>t.remaining>0).sort((a,b)=>a.remaining-b.remaining)
      const totalRemaining = core.money(treatments.reduce((s,t)=>s+t.remaining,0))
      if (core.cents(final)>core.cents(totalRemaining)) throw new Error('المبلغ المدخل يتجاوز إجمالي المبلغ المطلوب')
      const batchId=uuid(), distribution=[]
      let left=core.cents(final), discountLeft=core.cents(data.discount_amount ?? 0), taxLeft=core.cents(data.tax_amount ?? 0)
      for (const treatment of treatments) {
        if (!left) break
        const paidCents=Math.min(left,core.cents(treatment.remaining))
        // Distribute adjustments exactly once and preserve their batch totals.
        const discount=left===paidCents ? discountLeft : Math.floor(core.cents(data.discount_amount ?? 0)*paidCents/core.cents(final))
        const tax=Math.min(paidCents+discount, left===paidCents ? taxLeft : Math.floor(core.cents(data.tax_amount ?? 0)*paidCents/core.cents(final)))
        const p=this.createPaymentSync({...data,patient_id:patientId,tooth_treatment_id:treatment.id,amount:(paidCents+discount-tax)/100,discount_amount:discount/100,tax_amount:tax/100,status:'completed',is_comprehensive:true,comprehensive_batch_id:batchId})
        distribution.push({paymentId:p.id,treatmentId:treatment.id,toothNumber:treatment.tooth_number,toothName:treatment.tooth_name,treatmentType:treatment.treatment_type,treatmentCost:treatment.cost,previousPaid:treatment.paid,amountPaid:paidCents/100,newTotalPaid:p.amount_paid,newRemainingBalance:p.remaining_balance,status:p.status})
        left-=paidCents; discountLeft-=discount; taxLeft-=tax
      }
      return {success:true,message:`تم توزيع الدفعة على ${distribution.length} علاج بنجاح`,paymentsCreated:distribution.length,distribution,batchId,totalAmount:final,totalRemaining,remainingToDistribute:left/100}
    })).immediate()
  }
  createToothTreatmentSync(treatment) {



    const { v4: uuidv4 } = require('uuid')
    const id = uuidv4()
    const now = new Date().toISOString()
    const toothNumbers = Array.isArray(treatment.tooth_numbers)
      ? treatment.tooth_numbers.map(Number).filter(Number.isFinite)
      : typeof treatment.tooth_numbers === 'string' && treatment.tooth_numbers.trim()
        ? treatment.tooth_numbers.split(',').map(value => Number(value.trim())).filter(Number.isFinite)
        : [Number(treatment.tooth_number)]
    const normalizedToothNumbers = Array.from(new Set(toothNumbers.length > 0 ? toothNumbers : [Number(treatment.tooth_number)]))
      .sort((a, b) => a - b)
    const toothNumbersValue = normalizedToothNumbers.join(',')
    const isMultiTooth = normalizedToothNumbers.length > 1 ? 1 : 0

    // Auto-assign priority if not provided
    if (!treatment.priority) {
      const maxPriorityStmt = this.db.prepare(`
        SELECT COALESCE(MAX(priority), 0) + 1 as next_priority
        FROM tooth_treatments
        WHERE patient_id = ? AND tooth_number = ?
      `)
      const result = maxPriorityStmt.get(treatment.patient_id, treatment.tooth_number)
      treatment.priority = result.next_priority
    }

    const stmt = this.db.prepare(`
      INSERT INTO tooth_treatments (
        id, patient_id, tooth_number, tooth_numbers, is_multi_tooth, tooth_name, treatment_type, treatment_category,
        treatment_status, treatment_color, start_date, completion_date, cost,
        priority, notes, appointment_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      id, treatment.patient_id, treatment.tooth_number, toothNumbersValue, isMultiTooth, treatment.tooth_name,
      treatment.treatment_type, treatment.treatment_category, treatment.treatment_status,
      treatment.treatment_color, treatment.start_date, treatment.completion_date,
      treatment.cost, treatment.priority, treatment.notes, treatment.appointment_id,
      now, now
    )

    return { ...treatment, tooth_numbers: toothNumbersValue, is_multi_tooth: isMultiTooth, id, created_at: now, updated_at: now }
  }

  async createToothTreatment(treatment) {
    this.ensureConnection()
    this.ensureToothTreatmentsTableExists()
    this.ensurePaymentsColumns()
    return this.db.transaction(() => this.withFinancialRequest(treatment.request_id, treatment, () => {
      core.validatePaymentAmounts(treatment.cost ?? 0)
      if (!treatment.patient_id || !treatment.treatment_type || !treatment.treatment_category || !Number.isInteger(treatment.tooth_number)) throw new Error('بيانات العلاج غير مكتملة')
      if (!this.db.prepare('SELECT id FROM patients WHERE id = ?').get(treatment.patient_id)) throw new Error('المريض غير موجود')
      if (treatment.immediate_payment && core.cents(treatment.cost ?? 0) <= 0) throw new Error('تكلفة العلاج غير صالحة للدفع الكامل')
      const {immediate_payment, request_id, ...data} = treatment
      const created = this.createToothTreatmentSync({...data})
      if (immediate_payment) {
        const paid = this.createPaymentSync({patient_id:created.patient_id,tooth_treatment_id:created.id,amount:created.cost,payment_method:immediate_payment.payment_method || 'cash',payment_date:immediate_payment.payment_date || new Date().toISOString().slice(0,10),status:'completed',description:created.treatment_type,receipt_number:request_id ? 'RCP-' + request_id : 'RCP-' + uuid()})
        return {...created, immediate_payment_id:paid.id}
      }
      return created
    })).immediate()
  }
}
module.exports = {PaymentRepository}
