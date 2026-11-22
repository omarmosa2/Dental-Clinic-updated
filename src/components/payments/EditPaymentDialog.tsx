import { finalAmount, sumPayments, balance, previewPayment, validatePaymentAmounts, getTransactionAmount, isRevenuePaymentStatus } from '@/services/paymentCore.mjs'
import React, { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { usePaymentStore } from '@/store/paymentStore'
import { usePatientStore } from '@/store/patientStore'
import { useAppointmentStore } from '@/store/appointmentStore'
import { useDentalTreatmentStore } from '@/store/dentalTreatmentStore'
import { useToast } from '@/hooks/use-toast'
import { getTreatmentNameInArabic } from '@/utils/arabicTranslations'
import { formatTreatmentTeeth } from '@/utils/toothTreatmentUtils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Edit, CreditCard, DollarSign, Receipt, Calculator, Sparkles, AlertCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useCurrency } from '@/contexts/CurrencyContext'
import type { Payment } from '@/types'

interface EditPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payment: Payment
}

export default function EditPaymentDialog({ open, onOpenChange, payment }: EditPaymentDialogProps) {
  const submittingRef = useRef(false)
  const { toast } = useToast()
  const { updatePayment, isLoading, getPaymentsByPatient, getPaymentsByAppointment, getPaymentsByToothTreatment } = usePaymentStore()
  const { patients } = usePatientStore()
  const { appointments } = useAppointmentStore()
  const { toothTreatments, loadToothTreatmentsByPatient } = useDentalTreatmentStore()
  const { formatAmount } = useCurrency()

  const [formData, setFormData] = useState({
    patient_id: '',
    tooth_treatment_id: 'none',
    appointment_id: 'none',
    amount: '',
    payment_method: 'cash' as 'cash' | 'bank_transfer',
    payment_date: '',
    description: '',
    receipt_number: '',
    status: 'completed' as Payment['status'],
    notes: '',
    discount_amount: '',
    tax_amount: '',
    total_amount_due: '',
    amount_paid: '',
  })

  const [autoCalculations, setAutoCalculations] = useState({
    previousPayments: 0,
    originalAmount: 0,
    isCalculating: false
  })

  // توليد رقم إيصال تلقائي احترافي
  const generateReceiptNumber = () => {
    const now = new Date()
    const year = now.getFullYear().toString().slice(-2)
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const day = now.getDate().toString().padStart(2, '0')
    const time = now.getTime().toString().slice(-4)
    return `RCP-${year}${month}${day}-${time}`
  }

  // حساب إجمالي المدفوعات السابقة للموعد المحدد (باستثناء هذه الدفعة)
  const calculatePreviousPayments = (appointmentId: string, excludePaymentId: string) => {
    if (!appointmentId || appointmentId === 'none') return 0
    const appointmentPayments = getPaymentsByAppointment(appointmentId)
    return sumPayments(appointmentPayments.filter(p => p.id !== excludePaymentId && !p.tooth_treatment_id))
  }

  // جلب تكلفة الموعد تلقائياً
  const getAppointmentCost = (appointmentId: string) => {
    if (!appointmentId || appointmentId === 'none') return 0
    const appointment = appointments.find(apt => apt.id === appointmentId)
    return appointment?.cost || 0
  }

  // حساب إجمالي المبلغ المدفوع تلقائياً (المدفوعات السابقة + الدفعة الحالية)
  const getPreview = () => previewPayment({cost:formData.total_amount_due,previousPaid:autoCalculations.previousPayments,
    amount:formData.amount,discount:formData.discount_amount,tax:formData.tax_amount,
    countsAsPaid: !['cancelled','refunded','failed','overdue'].includes(formData.status)})
  const calculateTotalAmountPaid = () => getPreview().totalPaid
  const calculateRemainingBalance = () => getPreview().remainingBalance
  const calculateTotalAmount = () => getPreview().totalAmount

  // تحديث الحسابات التلقائية عند تغيير الموعد
  useEffect(() => {
    if (formData.tooth_treatment_id && formData.tooth_treatment_id !== 'none' && payment) {
      setAutoCalculations({previousPayments:sumPayments(getPaymentsByToothTreatment(formData.tooth_treatment_id).filter(p=>p.id!==payment.id)),originalAmount:payment.amount,isCalculating:false})
    } else if (formData.appointment_id && formData.appointment_id !== 'none' && payment) {
      setAutoCalculations(prev => ({ ...prev, isCalculating: true }))

      const previousPayments = calculatePreviousPayments(formData.appointment_id, payment.id)
      const originalAmount = payment.amount

      setAutoCalculations({
        previousPayments,
        originalAmount,
        isCalculating: false
      })
    } else if (payment) {
      // إذا لم يتم اختيار موعد، اجعل المدفوعات السابقة = 0
      setAutoCalculations({
        previousPayments: 0,
        originalAmount: payment.amount,
        isCalculating: false
      })
    }
  }, [formData.appointment_id, formData.tooth_treatment_id, payment, getPaymentsByToothTreatment])

  // تحديث المبلغ المطلوب عند تغيير الموعد أو العلاج
  useEffect(() => {
    if (formData.appointment_id && formData.appointment_id !== 'none') {
      const appointmentCost = getAppointmentCost(formData.appointment_id)
      if (appointmentCost > 0 && !formData.total_amount_due) {
        setFormData(prev => ({
          ...prev,
          total_amount_due: appointmentCost.toString()
        }))
      }
    }
  }, [formData.appointment_id])

  // تحديث المبلغ المطلوب عند تغيير العلاج
  useEffect(() => {
    if (formData.tooth_treatment_id && formData.tooth_treatment_id !== 'none') {
      const treatment = toothTreatments.find(t => t.id === formData.tooth_treatment_id)
      if (treatment && treatment.cost) {
        setFormData(prev => ({
          ...prev,
          total_amount_due: treatment.cost.toString()
        }))
      }
    }
  }, [formData.tooth_treatment_id, toothTreatments])

  // تحديث إجمالي المبلغ المدفوع تلقائياً
  useEffect(() => {
    if (formData.amount && autoCalculations.previousPayments >= 0) {
      const totalPaid = calculateTotalAmountPaid()
      setFormData(prev => ({
        ...prev,
        amount_paid: totalPaid.toString()
      }))
    }
  }, [formData.amount, formData.discount_amount, formData.tax_amount, autoCalculations.previousPayments])

  useEffect(() => {
    if (payment && open) {
      setFormData({
        patient_id: payment.patient_id || '',
        tooth_treatment_id: payment.tooth_treatment_id || 'none',
        appointment_id: payment.appointment_id || 'none',
        amount: payment.amount.toString(),
        payment_method: payment.payment_method,
        payment_date: payment.payment_date.split('T')[0],
        description: payment.description || '',
        receipt_number: payment.receipt_number || '',
        status: payment.status,
        notes: payment.notes || '',
        discount_amount: payment.discount_amount?.toString() || '',
        tax_amount: payment.tax_amount?.toString() || '',
        total_amount_due: payment.total_amount_due?.toString() || '',
        amount_paid: payment.amount_paid?.toString() || '',
      })

      // تحميل العلاجات للمريض
      if (payment.patient_id) {
        loadToothTreatmentsByPatient(payment.patient_id)
      }
    }
  }, [payment, open])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  // اقتراح الحالة تلقائياً بناءً على المبلغ
  const getSuggestedStatus = (): Payment['status'] => {
    if (['cancelled','refunded','failed','overdue'].includes(formData.status)) return formData.status
    if (Number(formData.amount) === 0) return 'pending'
    return getPreview().status
  }

  // تحديث الحالة تلقائياً عند تغيير المبلغ أو المبلغ الإجمالي
  useEffect(() => {
    // تحديث الحالة إذا كان هناك مبلغ إجمالي مطلوب أو مبلغ مدفوع
    const amount = formData.amount ? parseFloat(formData.amount) : 0
    const totalAmountDue = formData.total_amount_due ? parseFloat(formData.total_amount_due) : 0

    if (totalAmountDue > 0 || amount > 0) {
      const suggestedStatus = getSuggestedStatus()
      setFormData(prev => ({
        ...prev,
        status: suggestedStatus
      }))
    }
  }, [formData.amount, formData.total_amount_due, formData.appointment_id, formData.tooth_treatment_id, formData.discount_amount, formData.tax_amount, autoCalculations.previousPayments])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submittingRef.current) return

    if (!formData.patient_id || !formData.payment_date) {
      toast({
        title: 'خطأ',
        description: 'يرجى ملء جميع الحقول المطلوبة',
        variant: 'destructive',
      })
      return
    }

    submittingRef.current = true
    try {
      const amount = formData.amount ? parseFloat(formData.amount) : 0
      const discountAmount = formData.discount_amount ? parseFloat(formData.discount_amount) : 0
      const taxAmount = formData.tax_amount ? parseFloat(formData.tax_amount) : 0
      validatePaymentAmounts(amount,discountAmount,taxAmount)
      if (amount <= 0 && !(amount === 0 && payment.amount === 0 && formData.status === 'pending')) throw new Error('يجب أن يكون مبلغ الدفعة أكبر من صفر')
      const totalAmount = finalAmount(amount,discountAmount,taxAmount)
      if (isRevenuePaymentStatus(formData.status) && totalAmount <= 0) throw new Error('يجب أن يكون صافي مبلغ الدفعة أكبر من صفر')
      const linked = formData.tooth_treatment_id !== 'none' || formData.appointment_id !== 'none'
      if (linked && isRevenuePaymentStatus(formData.status) && totalAmount > balance(Number(formData.total_amount_due)||0,autoCalculations.previousPayments)) throw new Error('مبلغ الدفعة يتجاوز المبلغ المتبقي')
      const totalAmountDue = formData.total_amount_due ? parseFloat(formData.total_amount_due) : totalAmount
      const amountPaid = calculateTotalAmountPaid() // استخدام الحساب التلقائي
      const remainingBalance = balance(totalAmountDue,amountPaid)

      // استخدام معرف العلاج من الدفعة الأصلية إذا كانت مرتبطة بعلاج، وإلا استخدم القيمة من النموذج
      const treatmentId = payment.tooth_treatment_id && payment.tooth_treatment_id !== 'none'
        ? payment.tooth_treatment_id
        : (formData.tooth_treatment_id && formData.tooth_treatment_id !== 'none' ? formData.tooth_treatment_id : undefined)

      const paymentData = {
        patient_id: formData.patient_id,
        tooth_treatment_id: treatmentId,
        appointment_id: !treatmentId && formData.appointment_id && formData.appointment_id !== 'none' ? formData.appointment_id : undefined,
        amount: amount,
        payment_method: formData.payment_method,
        payment_date: formData.payment_date,
        description: formData.description,
        receipt_number: formData.receipt_number || generateReceiptNumber(), // استخدام التوليد التلقائي إذا كان فارغاً
        status: formData.status,
        notes: formData.notes,
        discount_amount: discountAmount,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        total_amount_due: totalAmountDue,
        amount_paid: amountPaid,
        remaining_balance: remainingBalance,
      }

      console.log('🔄 Submitting payment update:', paymentData)
      await updatePayment(payment.id, paymentData)

      toast({
        title: 'تم بنجاح',
        description: 'تم تحديث الدفعة بنجاح',
      })

      onOpenChange(false)
    } catch (error) {
      console.error('❌ Failed to update payment:', error)
      toast({
        title: 'خطأ',
        description: error instanceof Error ? error.message : 'فشل في تحديث الدفعة',
        variant: 'destructive',
      })
    } finally { submittingRef.current = false }
  }

  const filteredAppointments = appointments.filter(
    appointment => appointment.patient_id === formData.patient_id
  )

  const filteredToothTreatments = toothTreatments.filter(
    treatment => {
      if (treatment.patient_id !== formData.patient_id) return false

      // اعرض العلاج الحالي إذا كان مرتبطاً بهذه الدفعة
      if (payment.tooth_treatment_id === treatment.id) return true

      // التحقق من حالة الدفع للعلاج
      const treatmentPayments = getPaymentsByToothTreatment(treatment.id)
      const treatmentCost = treatment.cost || 0

      // إذا لم توجد مدفوعات، اعرض العلاج
      if (treatmentPayments.length === 0) return true

      // حساب إجمالي المدفوع (فقط المدفوعات المكتملة والجزئية)
      const totalPaid = treatmentPayments
        .filter(p => isRevenuePaymentStatus(p.status))
        .reduce((sum, p) => sum + getTransactionAmount(p), 0)

      // إخفاء العلاجات المدفوعة بالكامل فقط
      return totalPaid < treatmentCost
    }
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="4xl" className="overflow-y-auto max-h-[90vh] bg-background" dir="rtl">
        <DialogHeader className="border-b border-border pb-4">
          <DialogTitle className="flex items-center text-xl font-semibold text-foreground">
            <Edit className="w-5 h-5 ml-2 text-primary" />
            تعديل الدفعة
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            تعديل بيانات الدفعة رقم {payment.receipt_number || payment.id.slice(-6)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* تحذير للدفعات المرتبطة بالعلاجات */}
          {formData.tooth_treatment_id !== 'none' && (
            <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <h4 className="font-medium text-orange-800 dark:text-orange-200">
                    دفعة مرتبطة بعلاج
                  </h4>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    هذه الدفعة مرتبطة بعلاج محدد. المبلغ الإجمالي المطلوب مرتبط بتكلفة العلاج ولا يمكن تعديله من هنا.
                    لتعديل المبلغ، قم بتعديل تكلفة العلاج من قسم العلاجات.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Patient Selection */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center text-lg text-card-foreground">
                <Receipt className="w-4 h-4 ml-2 text-primary" />
                معلومات المريض
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Patient Selection */}
                <div className="space-y-2">
                  <Label htmlFor="patient_id" className="text-foreground font-medium">المريض *</Label>
                  <Select
                    value={formData.patient_id}
                    onValueChange={(value) => handleInputChange('patient_id', value)}
                  >
                    <SelectTrigger className="bg-background border-input text-foreground">
                      <SelectValue placeholder="اختر المريض" className="text-muted-foreground" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map((patient) => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {patient.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Treatment Selection */}
                <div className="space-y-2">
                  <Label htmlFor="tooth_treatment_id" className="text-foreground font-medium">العلاج</Label>
                  {payment.tooth_treatment_id && payment.tooth_treatment_id !== 'none' ? (
                    // عرض العلاج المحدد كنص ثابت عندما تكون الدفعة مرتبطة بعلاج
                    <div className="space-y-2">
                      <div className="p-3 bg-muted/50 border border-border rounded-md">
                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            {(() => {
                              const linkedTreatment = toothTreatments.find(t => t.id === payment.tooth_treatment_id)
                              if (linkedTreatment) {
                                return (
                                  <>
                                    <span className="font-medium text-foreground">
                                      الأسنان {formatTreatmentTeeth(linkedTreatment)} - {getTreatmentNameInArabic(linkedTreatment.treatment_type)}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      التكلفة: {formatAmount(linkedTreatment.cost || 0)}
                                    </span>
                                  </>
                                )
                              } else {
                                return <span className="text-muted-foreground">العلاج المرتبط (معرف: {payment.tooth_treatment_id})</span>
                              }
                            })()}
                          </div>
                          <Badge variant="secondary" className="text-xs">
                            مرتبط
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        ⚠️ لا يمكن تغيير العلاج للمدفوعات المرتبطة بعلاج محدد
                      </p>
                      {/* حقل مخفي للحفاظ على قيمة العلاج */}
                      <input type="hidden" value={payment.tooth_treatment_id} />
                    </div>
                  ) : (
                    // القائمة المنسدلة العادية للمدفوعات غير المرتبطة بعلاج
                    <Select
                      value={formData.tooth_treatment_id}
                      onValueChange={(value) => handleInputChange('tooth_treatment_id', value)}
                    >
                      <SelectTrigger className="bg-background border-input text-foreground">
                        <SelectValue placeholder="اختر العلاج" className="text-muted-foreground" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">بدون علاج محدد</SelectItem>
                        {filteredToothTreatments.map((treatment) => {
                          // حساب المبلغ المتبقي للعلاج
                          const treatmentPayments = getPaymentsByToothTreatment(treatment.id)
                          const treatmentCost = treatment.cost || 0
                          const totalPaid = treatmentPayments
                            .filter(p => p.status === 'completed' || p.status === 'partial')
                            .reduce((sum, p) => sum + getTransactionAmount(p), 0)
                          const remainingAmount = treatmentCost - totalPaid

                          return (
                            <SelectItem key={treatment.id} value={treatment.id}>
                              <div className="flex flex-col">
                                <span>{`الأسنان ${formatTreatmentTeeth(treatment)} - ${getTreatmentNameInArabic(treatment.treatment_type)}`}</span>
                                <div className="text-xs text-muted-foreground">
                                  <span>التكلفة: {formatAmount(treatmentCost)}</span>
                                  {remainingAmount > 0 && remainingAmount < treatmentCost && (
                                    <span className="text-orange-600 font-medium"> • متبقي: {formatAmount(remainingAmount)}</span>
                                  )}
                                </div>
                              </div>
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Appointment Selection (للتوافق مع النظام القديم) - مخفي */}
                <div className="space-y-2 hidden">
                  <Label htmlFor="appointment_id" className="text-foreground font-medium">الموعد (اختياري)</Label>
                  <Select
                    value={formData.appointment_id}
                    onValueChange={(value) => handleInputChange('appointment_id', value)}
                  >
                    <SelectTrigger className="bg-background border-input text-foreground">
                      <SelectValue placeholder="اختر الموعد" className="text-muted-foreground" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون موعد محدد</SelectItem>
                      {filteredAppointments.map((appointment) => (
                        <SelectItem key={appointment.id} value={appointment.id}>
                          {appointment.title} - {formatDate(appointment.start_time)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Amount and Payment Details */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center text-lg text-card-foreground">
                <DollarSign className="w-4 h-4 ml-2 text-primary" />
                تفاصيل المبالغ والدفع
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="amount" className="text-foreground font-medium">المبلغ</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => handleInputChange('amount', e.target.value)}
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value) || 0
                      handleInputChange('amount', value.toString())
                    }}
                    placeholder="0.00"
                    className="bg-background border-input text-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment_method" className="text-foreground font-medium">طريقة الدفع</Label>
                  <Select
                    value={formData.payment_method}
                    onValueChange={(value) => handleInputChange('payment_method', value)}
                  >
                    <SelectTrigger className="bg-background border-input text-foreground">
                      <SelectValue placeholder="اختر طريقة الدفع" className="text-muted-foreground" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">نقداً</SelectItem>
                      <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="payment_date" className="text-foreground font-medium">تاريخ الدفع *</Label>
                  <Input
                    id="payment_date"
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => handleInputChange('payment_date', e.target.value)}
                    required
                    className="bg-background border-input text-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status" className="text-foreground font-medium">
                    الحالة
                    {formData.amount && parseFloat(formData.amount) > 0 && (
                      <span className="text-xs text-muted-foreground mr-2">
                        (مقترح: {getSuggestedStatus() === 'completed' ? 'مكتمل' :
                                getSuggestedStatus() === 'partial' ? 'جزئي' : 'معلق'})
                      </span>
                    )}
                  </Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => handleInputChange('status', value)}
                  >
                    <SelectTrigger className="bg-background border-input text-foreground">
                      <SelectValue placeholder="اختر الحالة" className="text-muted-foreground" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="completed">
                        <div className="flex items-center gap-2">
                          <span>مكتمل</span>
                          {getSuggestedStatus() === 'completed' && (
                            <span className="text-xs text-green-600">✓ مقترح</span>
                          )}
                        </div>
                      </SelectItem>
                      <SelectItem value="partial">
                        <div className="flex items-center gap-2">
                          <span>جزئي</span>
                          {getSuggestedStatus() === 'partial' && (
                            <span className="text-xs text-orange-600">✓ مقترح</span>
                          )}
                        </div>
                      </SelectItem>
                      <SelectItem value="pending">
                        <div className="flex items-center gap-2">
                          <span>معلق</span>
                          {getSuggestedStatus() === 'pending' && (
                            <span className="text-xs text-blue-600">✓ مقترح</span>
                          )}
                        </div>
                      </SelectItem>
                      <SelectItem value="paid">مدفوع</SelectItem>
                      <SelectItem value="cancelled">ملغى</SelectItem>
                      <SelectItem value="refunded">مسترد</SelectItem>
                      <SelectItem value="failed">فاشل</SelectItem>
                      <SelectItem value="overdue">متأخر</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="discount_amount" className="text-foreground font-medium">مبلغ الخصم</Label>
                  <Input
                    id="discount_amount"
                    type="number"
                    step="0.01"
                    value={formData.discount_amount}
                    onChange={(e) => handleInputChange('discount_amount', e.target.value)}
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value) || 0
                      handleInputChange('discount_amount', value.toString())
                    }}
                    placeholder="0.00"
                    className="bg-background border-input text-foreground"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax_amount" className="text-foreground font-medium">مبلغ الضريبة</Label>
                  <Input
                    id="tax_amount"
                    type="number"
                    step="0.01"
                    value={formData.tax_amount}
                    onChange={(e) => handleInputChange('tax_amount', e.target.value)}
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value) || 0
                      handleInputChange('tax_amount', value.toString())
                    }}
                    placeholder="0.00"
                    className="bg-background border-input text-foreground"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Tracking Section */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center text-lg text-card-foreground">
                <Sparkles className="w-4 h-4 ml-2 text-primary" />
                تتبع المدفوعات التلقائي
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                تتبع المبالغ المطلوبة والمدفوعة والمتبقية مع الحسابات التلقائية
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Auto Calculations Info */}
              {formData.appointment_id && formData.appointment_id !== 'none' && (
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-200 dark:border-blue-800 shadow-sm transition-all duration-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span className="text-sm font-medium text-primary">الحسابات التلقائية للموعد</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">المدفوعات السابقة لهذا الموعد:</span>
                        <span className="font-medium text-foreground">${autoCalculations.previousPayments.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">المبلغ الأصلي لهذه الدفعة:</span>
                        <span className="font-medium text-foreground">${autoCalculations.originalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {formData.appointment_id === 'none' && (
                <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-950/50 dark:to-yellow-900/30 border-yellow-200 dark:border-yellow-800 shadow-sm transition-all duration-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
                      <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">دفعة بدون موعد محدد</span>
                    </div>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                      هذه الدفعة غير مرتبطة بموعد محدد، لذلك لا توجد مدفوعات سابقة مرتبطة بها
                    </p>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Total Amount Due */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-foreground font-medium" htmlFor="total_amount_due">
                    المبلغ الإجمالي المطلوب
                    {formData.tooth_treatment_id !== 'none' && (
                      <Badge variant="outline" className="text-xs text-orange-600 border-orange-600">
                        🔒 مرتبط بالعلاج
                      </Badge>
                    )}
                    {formData.appointment_id !== 'none' && formData.tooth_treatment_id === 'none' && (
                      <Badge variant="secondary" className="text-xs">
                        <Sparkles className="w-3 h-3 ml-1" />
                        تلقائي
                      </Badge>
                    )}
                  </Label>
                  <Input
                    id="total_amount_due"
                    type="number"
                    step="0.01"
                    value={formData.total_amount_due}
                    onChange={(e) => handleInputChange('total_amount_due', e.target.value)}
                    onBlur={(e) => {
                      const value = parseFloat(e.target.value) || 0
                      handleInputChange('total_amount_due', value.toString())
                    }}
                    placeholder="0.00"
                    className={`bg-background border-input text-foreground ${
                      formData.tooth_treatment_id !== 'none'
                        ? 'opacity-60 cursor-not-allowed bg-muted'
                        : ''
                    }`}
                    disabled={formData.tooth_treatment_id !== 'none'} // تعطيل التعديل للدفعات المرتبطة بالعلاجات
                  />
                  <p className="text-xs text-muted-foreground">
                    {formData.tooth_treatment_id !== 'none'
                      ? '🔒 المبلغ مرتبط بتكلفة العلاج ولا يمكن تعديله هنا. لتعديل المبلغ، قم بتعديل تكلفة العلاج من قسم العلاجات.'
                      : formData.appointment_id !== 'none'
                      ? 'تم جلب المبلغ من الموعد المحدد تلقائياً'
                      : 'المبلغ الكامل المطلوب للعلاج أو الخدمة'
                    }
                  </p>
                </div>

                {/* Amount Paid */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-foreground font-medium" htmlFor="amount_paid">
                    إجمالي المبلغ المدفوع
                    <Badge variant="secondary" className="text-xs">
                      <Sparkles className="w-3 h-3 ml-1" />
                      محسوب تلقائياً
                    </Badge>
                  </Label>
                  <Input
                    id="amount_paid"
                    type="number"
                    step="0.01"
                    value={formData.amount_paid}
                    readOnly
                    className="bg-muted cursor-not-allowed border-input text-foreground font-medium"
                    placeholder="0.00"
                  />
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    ✓ محسوب تلقائياً: المدفوعات السابقة ({formatAmount(autoCalculations.previousPayments)}) + هذه الدفعة ({formatAmount(parseFloat(formData.amount) || 0)})
                  </p>
                </div>
              </div>

              {/* Remaining Balance Display */}
              {formData.total_amount_due && (
                <Card className={`shadow-sm transition-all duration-200 ${
                  calculateRemainingBalance() > 0
                    ? "bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950/50 dark:to-orange-900/30 border-orange-200 dark:border-orange-800"
                    : "bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 border-green-200 dark:border-green-800"
                }`}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-foreground">المبلغ المتبقي:</span>
                      <Badge variant={calculateRemainingBalance() > 0 ? "destructive" : "default"} className="text-lg px-3 py-1">
                        ${calculateRemainingBalance().toFixed(2)}
                      </Badge>
                    </div>
                    {calculateRemainingBalance() === 0 && (
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mt-2">✓ تم سداد المبلغ بالكامل</p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Payment Summary */}
              <Card className="bg-gradient-to-r from-muted/30 to-muted/50 border-border">
                <CardHeader>
                  <CardTitle className="text-sm text-card-foreground">ملخص هذه الدفعة</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المبلغ الأساسي:</span>
                    <span className="font-medium text-foreground">${(parseFloat(formData.amount) || 0).toFixed(2)}</span>
                  </div>
                  {formData.tax_amount && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الضريبة:</span>
                      <span className="text-orange-600 dark:text-orange-400 font-medium">+${(parseFloat(formData.tax_amount) || 0).toFixed(2)}</span>
                    </div>
                  )}
                  {formData.discount_amount && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الخصم:</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">-${(parseFloat(formData.discount_amount) || 0).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium border-t border-border pt-2">
                    <span className="text-foreground">إجمالي هذه الدفعة:</span>
                    <Badge variant="outline" className="text-base">
                      ${calculateTotalAmount().toFixed(2)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          {/* Additional Information */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg text-card-foreground">معلومات إضافية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-foreground" htmlFor="receipt_number">
                  رقم الإيصال
                  <Badge variant="secondary" className="text-xs">
                    <Sparkles className="w-3 h-3 ml-1" />
                    مولد تلقائياً
                  </Badge>
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="receipt_number"
                    value={formData.receipt_number}
                    onChange={(e) => handleInputChange('receipt_number', e.target.value)}
                    placeholder="رقم الإيصال"
                    className="flex-1 bg-background border-input text-foreground"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleInputChange('receipt_number', generateReceiptNumber())}
                    className="px-3"
                  >
                    <Sparkles className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ يمكن توليد رقم إيصال جديد تلقائياً
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-foreground">الوصف</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="وصف الدفعة"
                  rows={3}
                  className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes" className="text-foreground">ملاحظات</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="ملاحظات إضافية"
                  rows={3}
                  className="bg-background border-input text-foreground placeholder:text-muted-foreground"
                />
              </div>
            </CardContent>
          </Card>

          <DialogFooter className="flex justify-end space-x-3 space-x-reverse border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isLoading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
