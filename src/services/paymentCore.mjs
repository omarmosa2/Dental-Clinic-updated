// Two-decimal clinic currency policy. Arithmetic uses integer minor units.
export function cents(value) {
  const number = Number(value ?? 0)
  if (!Number.isFinite(number) || Math.abs(number) > Number.MAX_SAFE_INTEGER / 100) throw new Error('مبلغ مالي غير صالح')
  return Math.round((number + Math.sign(number) * Number.EPSILON) * 100)
}
export function money(value) { return cents(value) / 100 }
export function isRevenuePaymentStatus(status) { return ['completed', 'partial', 'paid'].includes(status) }
export function getTransactionAmount(payment) {
  const value = Number(payment.total_amount ?? payment.amount ?? 0)
  return Number.isFinite(value) && value >= 0 ? money(value) : 0
}
export function getRevenueTransactionAmount(payment) {
  return isRevenuePaymentStatus(payment.status) ? getTransactionAmount(payment) : 0
}
export function sumPayments(payments) {
  return payments.reduce((sum, payment) => sum + cents(getRevenueTransactionAmount(payment)), 0) / 100
}
export function balance(cost, paid) { return Math.max(0, cents(cost) - cents(paid)) / 100 }
export function paymentStatus(cost, paid) {
  return cents(paid) <= 0 ? 'pending' : cents(paid) >= cents(cost) ? 'completed' : 'partial'
}
export function validatePaymentAmounts(amount, discount = 0, tax = 0) {
  for (const value of [amount, discount, tax]) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || Math.abs(value * 100 - cents(value)) > 0.000001) {
      throw new Error('يجب إدخال مبلغ غير سالب بدقة منزلتين عشريتين')
    }
  }
  if (cents(discount) > cents(amount) + cents(tax)) throw new Error('الخصم يتجاوز المبلغ مع الضريبة')
}
export function finalAmount(amount, discount = 0, tax = 0) {
  validatePaymentAmounts(amount, discount, tax)
  return (cents(amount) + cents(tax) - cents(discount)) / 100
}

// Balances are grouped by obligation. Cumulative fields must never be summed.
export function summarizePaymentBalances(payments) {
  const groups = new Map()
  for (const payment of payments) {
    const key = payment.tooth_treatment_id ? `t:${payment.tooth_treatment_id}` : payment.appointment_id ? `a:${payment.appointment_id}` : `p:${payment.id}`
    const cost = payment.tooth_treatment_id
      ? payment.tooth_treatment?.cost ?? payment.treatment_total_cost ?? payment.total_amount_due ?? 0
      : payment.appointment_id ? payment.appointment_total_cost ?? payment.total_amount_due ?? 0
      : payment.total_amount_due ?? getTransactionAmount(payment)
    const group = groups.get(key) || { cost: cents(cost), paid: 0, pending: false }
    group.paid += cents(getRevenueTransactionAmount(payment))
    group.pending ||= payment.status === 'pending'
    groups.set(key, group)
  }
  let due = 0, paid = 0, remaining = 0, pending = 0
  for (const group of groups.values()) {
    const outstanding = Math.max(0, group.cost - group.paid)
    due += group.cost; paid += group.paid; remaining += outstanding
    if (group.pending) pending += outstanding
  }
  return {totalDue:due / 100,totalPaid:paid / 100,remainingBalance:remaining / 100,pendingBalance:pending / 100}
}

// Safe form preview; strict validation still runs before every write.
export function previewPayment({cost = 0, previousPaid = 0, amount = 0, discount = 0, tax = 0, countsAsPaid = true}) {
  const safe = value => { try { return Number.isFinite(Number(value)) ? cents(Number(value)) : 0 } catch { return 0 } }
  const totalAmount = (safe(amount) + safe(tax) - safe(discount)) / 100
  const totalPaid = (safe(previousPaid) + (countsAsPaid ? cents(totalAmount) : 0)) / 100
  const totalCost = Number(cost) || totalAmount
  return {totalAmount,totalPaid,remainingBalance:balance(totalCost,totalPaid),status:paymentStatus(totalCost,totalPaid)}
}
