import { money, balance, paymentStatus, sumPayments, finalAmount, validatePaymentAmounts, getTransactionAmount, getRevenueTransactionAmount } from '@/services/paymentCore.mjs'
export { isRevenuePaymentStatus, getTransactionAmount, getRevenueTransactionAmount } from '@/services/paymentCore.mjs'
import { Payment, Appointment, ToothTreatment } from '@/types'

/**
 * حساب إجمالي المدفوعات لموعد محدد (فقط من الدفعات الجزئية والمكتملة)
 */
export function calculateAppointmentTotalPaid(appointmentId: string, payments: Payment[]): number {
      return sumPayments(payments.filter(p=>p.appointment_id === appointmentId && !p.tooth_treatment_id))
    }

/**
 * حساب الرصيد المتبقي لموعد محدد
 */
export function calculateAppointmentRemainingBalance(
  appointmentId: string,
  appointmentCost: number,
  payments: Payment[]
): number {
  const totalPaid = calculateAppointmentTotalPaid(appointmentId, payments)
  return balance(appointmentCost,totalPaid)
}

/**
 * حساب إجمالي المدفوعات لعلاج محدد (فقط من الدفعات الجزئية والمكتملة)
 */
export function calculateTreatmentTotalPaid(treatmentId: string, payments: Payment[]): number {
      return sumPayments(payments.filter(p=>p.tooth_treatment_id === treatmentId))
    }

/**
 * حساب الرصيد المتبقي لعلاج محدد
 */
export function calculateTreatmentRemainingBalance(
  treatmentId: string,
  treatmentCost: number,
  payments: Payment[]
): number {
  const totalPaid = calculateTreatmentTotalPaid(treatmentId, payments)
  return balance(treatmentCost,totalPaid)
}

/**
 * حساب حالة الدفع للموعد
 */
export function calculateAppointmentPaymentStatus(
  appointmentId: string,
  appointmentCost: number,
  payments: Payment[]
): 'completed' | 'partial' | 'pending' {
  const totalPaid = calculateAppointmentTotalPaid(appointmentId, payments)

  return paymentStatus(appointmentCost, totalPaid)
}

/**
 * حساب تفاصيل المدفوعات لموعد محدد
 */
export function calculateAppointmentPaymentDetails(appointmentId: string, appointmentCost: number, payments: Payment[]) {
      const appointmentPayments = payments.filter(p=>p.appointment_id===appointmentId && !p.tooth_treatment_id)
      const totalPaid = sumPayments(appointmentPayments)
      return {appointmentPayments,totalPaid,remainingBalance:balance(appointmentCost,totalPaid),status:paymentStatus(appointmentCost,totalPaid),appointmentCost,paymentCount:appointmentPayments.length}
    }

/**
 * التحقق من صحة مبلغ الدفعة الجديدة
 */
export function validateNewPaymentAmount(appointmentId: string, appointmentCost: number, newPaymentAmount: number, existingPayments: Payment[]): {isValid:boolean;error?:string;maxAllowed?:number} {
      try { validatePaymentAmounts(newPaymentAmount); if (newPaymentAmount <= 0) throw new Error('يجب أن يكون مبلغ الدفعة أكبر من صفر') }
      catch (error) { return {isValid:false,error:(error as Error).message} }
      if (!appointmentId) return {isValid:true}
      const maxAllowed=balance(appointmentCost,calculateAppointmentTotalPaid(appointmentId,existingPayments))
      return newPaymentAmount>maxAllowed ? {isValid:false,error:'مبلغ الدفعة يتجاوز المبلغ المتبقي',maxAllowed} : {isValid:true}
    }

/**
 * حساب البيانات المطلوبة لإنشاء دفعة جديدة
 */
export function calculatePaymentData(
  appointmentId: string | undefined,
  appointment: Appointment | undefined,
  amount: number,
  existingPayments: Payment[],
  discountAmount: number = 0,
  taxAmount: number = 0
) {
  const totalAmount = finalAmount(amount,discountAmount,taxAmount)

  if (appointmentId && appointment?.cost) {
    // دفعة مرتبطة بموعد
    const appointmentCost = appointment.cost
    const previousPayments = calculateAppointmentTotalPaid(appointmentId, existingPayments)
    const newTotalPaid = money(previousPayments + totalAmount)
    const remainingBalance = Math.max(0, appointmentCost - newTotalPaid)

    // تحديد الحالة
    let status: 'completed' | 'partial' | 'pending'
    if (remainingBalance <= 0) {
      status = 'completed'
    } else if (newTotalPaid > 0) {
      status = 'partial'
    } else {
      status = 'pending'
    }

    return {
      total_amount: totalAmount,
      appointment_total_cost: appointmentCost,
      appointment_total_paid: newTotalPaid,
      appointment_remaining_balance: remainingBalance,
      status,
      // حقول عامة فارغة للمدفوعات المرتبطة بموعد
      total_amount_due: undefined,
      amount_paid: undefined,
      remaining_balance: undefined
    }
  } else {
    // دفعة عامة غير مرتبطة بموعد
    return {
      total_amount: totalAmount,
      total_amount_due: totalAmount,
      amount_paid: totalAmount,
      remaining_balance: 0,
      status: paymentStatus(totalAmount, totalAmount),
      // حقول الموعد فارغة للمدفوعات العامة
      appointment_total_cost: undefined,
      appointment_total_paid: undefined,
      appointment_remaining_balance: undefined
    }
  }
}

/**
 * حساب ملخص المدفوعات لمريض محدد
 */
export function calculatePatientPaymentSummary(patientId: string, payments: Payment[], appointments: Appointment[], treatments: ToothTreatment[] = []) {
      const patientPayments=payments.filter(p=>p.patient_id===patientId)
      const patientAppointments=appointments.filter(a=>a.patient_id===patientId)
      const costs=new Map<string,number>()
      patientPayments.filter(p=>p.tooth_treatment_id).forEach(p=>costs.set(p.tooth_treatment_id!,p.tooth_treatment?.cost ?? p.treatment_total_cost ?? 0))
      treatments.filter(t=>t.patient_id===patientId).forEach(t=>costs.set(t.id,t.cost ?? 0))
      let totalDue=0,totalRemaining=0
      costs.forEach((cost,id)=>{totalDue+=cost;totalRemaining+=balance(cost,calculateTreatmentTotalPaid(id,patientPayments))})
      patientAppointments.forEach(a=>{const cost=a.cost ?? 0;totalDue+=cost;totalRemaining+=balance(cost,calculateAppointmentTotalPaid(a.id,patientPayments))})
      patientPayments.filter(p=>!p.tooth_treatment_id && !p.appointment_id).forEach(p=>{const cost=p.total_amount_due ?? getTransactionAmount(p);totalDue+=cost;totalRemaining+=balance(cost,getRevenueTransactionAmount(p))})
      return {totalPaid:sumPayments(patientPayments),totalDue:money(totalDue),totalRemaining:money(totalRemaining),appointmentCount:patientAppointments.length,paymentCount:patientPayments.length,completedAppointments:patientAppointments.filter(a=>(a.cost??0)>0 && paymentStatus(a.cost,calculateAppointmentTotalPaid(a.id,patientPayments))==='completed').length}
    }

/**
 * حساب إجمالي المبلغ المتبقي لجميع المرضى
 */
export function calculateTotalRemainingBalanceForAllPatients(payments: Payment[], appointments: Appointment[]): number {
  // الحصول على جميع معرفات المرضى الفريدة
  const patientIds = Array.from(new Set([
    ...payments.map(p => p.patient_id),
    ...appointments.map(a => a.patient_id)
  ]))

  let totalRemaining = 0

  // حساب المبلغ المتبقي لكل مريض
  patientIds.forEach(patientId => {
    const summary = calculatePatientPaymentSummary(patientId, payments, appointments)
    totalRemaining += summary.totalRemaining
  })

  return Math.round(totalRemaining * 100) / 100 // Round to 2 decimal places
}

/**
 * تحديث جميع المدفوعات المرتبطة بموعد عند تغيير تكلفة الموعد
 */
export function recalculateAppointmentPayments(appointmentId: string, newAppointmentCost: number, payments: Payment[]): Partial<Payment>[] {
      const matching=payments.filter(p=>p.appointment_id===appointmentId && !p.tooth_treatment_id)
      const totalPaid=sumPayments(matching)
      return matching.map(p=>({id:p.id,appointment_total_cost:newAppointmentCost,appointment_total_paid:totalPaid,appointment_remaining_balance:balance(newAppointmentCost,totalPaid),status:p.status}))
    }
