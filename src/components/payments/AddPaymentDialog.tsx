import React, { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { usePaymentStore } from '@/store/paymentStore'
import { usePatientStore } from '@/store/patientStore'
import { useDentalTreatmentStore } from '@/store/dentalTreatmentStore'
import { useToast } from '@/hooks/use-toast'
import { getTreatmentNameInArabic } from '@/utils/arabicTranslations'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CreditCard, DollarSign, Sparkles, User, Calendar, FileText, CheckCircle2, Layers } from 'lucide-react'
import { useCurrency } from '@/contexts/CurrencyContext'
import type { Payment } from '@/types'
import { Combobox } from '@/components/ui/combobox'

interface AddPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preSelectedPatientId?: string
}

export default function AddPaymentDialog({ open, onOpenChange, preSelectedPatientId }: AddPaymentDialogProps) {

  const { toast } = useToast()
  const { createPayment, updatePayment, isLoading, getPaymentsByToothTreatment, createComprehensivePayment, getUnpaidTreatmentsForPatient } = usePaymentStore()
  const { patients } = usePatientStore()
  const { toothTreatments, loadToothTreatmentsByPatient } = useDentalTreatmentStore()
  const { formatAmount } = useCurrency()

  const [formData, setFormData] = useState({
    patient_id: '',
    tooth_treatment_id: 'none',
    amount: '',
    payment_method: 'cash' as 'cash' | 'bank_transfer',
    payment_date: new Date().toISOString().split('T')[0],
    description: '',
    receipt_number: '',
    status: 'completed' as 'completed' | 'partial' | 'pending',
    notes: '',
    discount_amount: '',
    tax_amount: '',
    total_amount_due: '',
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [previousPayments, setPreviousPayments] = useState(0)
  const [unpaidTreatments, setUnpaidTreatments] = useState<any[]>([])
  const [totalUnpaidBalance, setTotalUnpaidBalance] = useState(0)
  const [isComprehensive, setIsComprehensive] = useState(false)
  const [patientRemainingBalances, setPatientRemainingBalances] = useState<Map<string, number>>(new Map())

  const generateReceiptNumber = () => {
    const now = new Date()
    const year = now.getFullYear().toString().slice(-2)
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const day = now.getDate().toString().padStart(2, '0')
    const time = now.getTime().toString().slice(-4)
    return `RCP-${year}${month}${day}-${time}`
  }

  const calculatePreviousPaymentsForTreatment = (toothTreatmentId: string) => {
    if (!toothTreatmentId || toothTreatmentId === 'none') return 0
    const treatmentPayments = getPaymentsByToothTreatment(toothTreatmentId)
    return treatmentPayments.reduce((total, payment) => total + payment.amount, 0)
  }

  const getTotalAmountDue = () => parseFloat(formData.total_amount_due) || 0
  const getCurrentAmount = () => parseFloat(formData.amount) || 0
  const getDiscountAmount = () => parseFloat(formData.discount_amount) || 0
  const getTaxAmount = () => parseFloat(formData.tax_amount) || 0
  const getTotalPaid = () => previousPayments + getCurrentAmount()
  const getRemainingBalance = () => Math.max(0, getTotalAmountDue() - getTotalPaid())
  const getFinalAmount = () => getCurrentAmount() + getTaxAmount() - getDiscountAmount()

  const getSuggestedStatus = (): 'completed' | 'partial' | 'pending' => {
    const amount = getCurrentAmount()
    const totalDue = getTotalAmountDue()

    if (isComprehensive) {
      if (amount >= totalUnpaidBalance) return 'completed'
      if (amount > 0) return 'partial'
      return 'pending'
    }

    if (totalDue > 0 && formData.tooth_treatment_id !== 'none') {
      const newTotalPaid = previousPayments + amount
      if (newTotalPaid >= totalDue) return 'completed'
      if (newTotalPaid > 0) return 'partial'
      return 'pending'
    }

    if (amount > 0) return 'completed'
    return 'pending'
  }

  // Load unpaid treatments when patient changes
  useEffect(() => {
    if (formData.patient_id && formData.patient_id !== '') {
      loadToothTreatmentsByPatient(formData.patient_id)
      loadUnpaidTreatments(formData.patient_id)
    } else {
      setUnpaidTreatments([])
      setTotalUnpaidBalance(0)
    }
  }, [formData.patient_id, loadToothTreatmentsByPatient])

  const loadUnpaidTreatments = async (patientId: string) => {
    try {
      const treatments = await getUnpaidTreatmentsForPatient(patientId)
      setUnpaidTreatments(treatments)
      const total = treatments.reduce((sum: number, t: any) => sum + (t.remaining_balance || 0), 0)
      setTotalUnpaidBalance(total)
    } catch (error) {
      console.error('Failed to load unpaid treatments:', error)
      setUnpaidTreatments([])
      setTotalUnpaidBalance(0)
    }
  }

  useEffect(() => {
    if (open && patients.length > 0) {
      patients.forEach(async (patient) => {
        try {
          const treatments = await getUnpaidTreatmentsForPatient(patient.id)
          const total = treatments.reduce((sum: number, t: any) => sum + (t.remaining_balance || 0), 0)
          setPatientRemainingBalances(prev => {
            const next = new Map(prev)
            next.set(patient.id, total)
            return next
          })
        } catch {
          setPatientRemainingBalances(prev => {
            const next = new Map(prev)
            next.set(patient.id, 0)
            return next
          })
        }
      })
    }
  }, [open, patients.length])

  // Handle treatment selection change
  useEffect(() => {
    if (formData.tooth_treatment_id === 'comprehensive') {
      setIsComprehensive(true)
      setFormData(prev => ({
        ...prev,
        total_amount_due: totalUnpaidBalance.toString(),
        amount: totalUnpaidBalance.toString(),
        receipt_number: prev.receipt_number || generateReceiptNumber()
      }))
    } else if (formData.tooth_treatment_id && formData.tooth_treatment_id !== 'none') {
      setIsComprehensive(false)
      const selectedTreatment = toothTreatments.find(t => t.id === formData.tooth_treatment_id)
      const treatmentCost = selectedTreatment?.cost || 0
      const prevPayments = calculatePreviousPaymentsForTreatment(formData.tooth_treatment_id)

      setPreviousPayments(prevPayments)

      setFormData(prev => ({
        ...prev,
        total_amount_due: treatmentCost.toString(),
        amount: Math.max(0, treatmentCost - prevPayments).toString(),
        receipt_number: prev.receipt_number || generateReceiptNumber()
      }))
    } else {
      setIsComprehensive(false)
      setPreviousPayments(0)
    }
  }, [formData.tooth_treatment_id, toothTreatments, totalUnpaidBalance])

  useEffect(() => {
    if (formData.amount && (previousPayments >= 0 || isComprehensive)) {
      const suggestedStatus = getSuggestedStatus()
      setFormData(prev => ({ ...prev, status: suggestedStatus }))
    }
  }, [formData.amount, formData.total_amount_due, formData.tooth_treatment_id, previousPayments, isComprehensive, totalUnpaidBalance])

  useEffect(() => {
    if (!open) {
      setFormData({
        patient_id: '',
        tooth_treatment_id: 'none',
        amount: '',
        payment_method: 'cash',
        payment_date: new Date().toISOString().split('T')[0],
        description: '',
        receipt_number: '',
        status: 'completed',
        notes: '',
        discount_amount: '',
        tax_amount: '',
        total_amount_due: '',
      })
      setErrors({})
      setPreviousPayments(0)
      setUnpaidTreatments([])
      setTotalUnpaidBalance(0)
      setIsComprehensive(false)
    }
  }, [open])

  useEffect(() => {
    if (open && preSelectedPatientId) {
      setFormData(prev => ({ ...prev, patient_id: preSelectedPatientId }))
    }
  }, [open, preSelectedPatientId])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.patient_id) {
      newErrors.patient_id = 'يرجى اختيار المريض'
    }

    const amount = getCurrentAmount()
    const totalDue = getTotalAmountDue()

    if (amount < 0) {
      newErrors.amount = 'المبلغ لا يمكن أن يكون سالباً'
    } else if (amount === 0 && totalDue === 0) {
      newErrors.amount = 'يرجى إدخال مبلغ صحيح'
    }

    if (!formData.payment_date) {
      newErrors.payment_date = 'يرجى اختيار تاريخ الدفع'
    }

    if (!isComprehensive && formData.tooth_treatment_id !== 'none' && totalDue > 0) {
      const remainingBefore = totalDue - previousPayments
      if (amount > remainingBefore) {
        newErrors.amount = `المبلغ لا يمكن أن يتجاوز المتبقي (${formatAmount(remainingBefore)})`
      }
      if (amount <= 0) {
        newErrors.amount = 'يجب أن يكون مبلغ الدفعة أكبر من صفر'
      }
    }

    if (isComprehensive && totalUnpaidBalance > 0) {
      const finalAmount = amount + getTaxAmount() - getDiscountAmount()
      if (finalAmount > totalUnpaidBalance) {
        newErrors.amount = 'المبلغ المدخل يتجاوز إجمالي المبلغ المطلوب'
      }
      if (amount <= 0) {
        newErrors.amount = 'يجب أن يكون مبلغ الدفعة أكبر من صفر'
      }
    }

    if (isComprehensive && totalUnpaidBalance === 0) {
      newErrors.amount = 'هذا المريض ليس لديه علاجات غير مدفوعة'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    try {
      const amount = getCurrentAmount()
      const discountAmount = getDiscountAmount()
      const taxAmount = getTaxAmount()
      const totalAmount = amount + taxAmount - discountAmount

      // Handle comprehensive payment
      if (isComprehensive) {
        const result = await createComprehensivePayment(
          formData.patient_id,
          amount,
          {
            payment_method: formData.payment_method,
            payment_date: formData.payment_date,
            description: formData.description || 'دفعة شاملة',
            receipt_number: formData.receipt_number || generateReceiptNumber(),
            notes: formData.notes,
            discount_amount: discountAmount,
            tax_amount: taxAmount
          }
        )

        toast({ title: 'تم بنجاح', description: result.message || 'تم تسجيل الدفعة الشاملة بنجاح' })
        onOpenChange(false)
        return
      }

      // Handle regular payment
      const totalAmountDue = getTotalAmountDue() || totalAmount

      const paymentData: Omit<Payment, 'id' | 'created_at' | 'updated_at'> = {
        patient_id: formData.patient_id,
        amount,
        payment_method: formData.payment_method,
        payment_date: formData.payment_date,
        description: formData.description || undefined,
        receipt_number: formData.receipt_number || generateReceiptNumber(),
        status: formData.status,
        notes: formData.notes || undefined,
        discount_amount: discountAmount > 0 ? discountAmount : undefined,
        tax_amount: taxAmount > 0 ? taxAmount : undefined,
        total_amount: totalAmount,
        total_amount_due: totalAmountDue,
      }

      if (formData.tooth_treatment_id !== 'none') {
        paymentData.tooth_treatment_id = formData.tooth_treatment_id
        paymentData.treatment_total_cost = totalAmountDue
        paymentData.treatment_total_paid = getTotalPaid()
        paymentData.treatment_remaining_balance = getRemainingBalance()
      } else {
        paymentData.amount_paid = getTotalPaid()
        paymentData.remaining_balance = getRemainingBalance()
      }

      if (formData.tooth_treatment_id !== 'none') {
        const existingPayments = getPaymentsByToothTreatment(formData.tooth_treatment_id)
        if (existingPayments.length > 0) {
          const pendingPayment = existingPayments.find(p => p.status === 'pending')
          const targetPayment = pendingPayment || existingPayments[0]
          const updatedAmount = targetPayment.amount + amount

          let newStatus: 'completed' | 'partial' | 'pending'
          if (updatedAmount >= totalAmountDue) newStatus = 'completed'
          else if (updatedAmount > 0) newStatus = 'partial'
          else newStatus = 'pending'

          await updatePayment(targetPayment.id, {
            amount: updatedAmount,
            payment_method: formData.payment_method,
            payment_date: formData.payment_date,
            description: formData.description || targetPayment.description,
            receipt_number: formData.receipt_number || targetPayment.receipt_number,
            status: newStatus,
            notes: formData.notes || targetPayment.notes,
            discount_amount: discountAmount > 0 ? discountAmount : targetPayment.discount_amount,
            tax_amount: taxAmount > 0 ? taxAmount : targetPayment.tax_amount,
            total_amount: updatedAmount + taxAmount - discountAmount,
            total_amount_due: totalAmountDue,
            treatment_total_cost: totalAmountDue,
            treatment_total_paid: updatedAmount,
            treatment_remaining_balance: Math.max(0, totalAmountDue - updatedAmount)
          })
        } else {
          await createPayment(paymentData)
        }
      } else {
        await createPayment(paymentData)
      }

      toast({ title: 'تم بنجاح', description: 'تم تسجيل الدفعة بنجاح' })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error instanceof Error ? error.message : 'فشل في تسجيل الدفعة',
        variant: 'destructive',
      })
    }
  }

  const filteredToothTreatments = toothTreatments.filter(treatment => {
    if (treatment.patient_id !== formData.patient_id) return false
    const treatmentPayments = getPaymentsByToothTreatment(treatment.id)
    const treatmentCost = treatment.cost || 0
    if (treatmentPayments.length === 0) return true
    const totalPaid = treatmentPayments
      .filter(p => p.status === 'completed' || p.status === 'partial')
      .reduce((sum, p) => sum + p.amount, 0)
    return totalPaid < treatmentCost
  })

  const comprehensivePatientOptions = patients
    .filter(p => {
      const remaining = patientRemainingBalances.get(p.id)
      return remaining !== undefined && remaining > 0
    })
    .map(p => ({ value: p.id, label: p.full_name }))

  const allPatientOptions = patients.map(p => ({ value: p.id, label: p.full_name }))

  const patientOptions = isComprehensive ? comprehensivePatientOptions : allPatientOptions

  const selectedTreatment = toothTreatments.find(t => t.id === formData.tooth_treatment_id)
  const remainingBalance = getRemainingBalance()
  const isFullyPaid = getTotalAmountDue() > 0 && remainingBalance === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col p-0 sm:max-w-4xl" dir="rtl">
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-l from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">تسجيل دفعة جديدة</DialogTitle>
              <DialogDescription className="text-sm mt-1">أدخل تفاصيل الدفعة وتتبع المدفوعات</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Patient & Treatment */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">بيانات المريض</h3>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">المريض <span className="text-destructive">*</span></Label>
                  <Combobox
                    options={patientOptions}
                    value={formData.patient_id}
                    onChange={(value) => {
                      setFormData(prev => ({ ...prev, patient_id: value, tooth_treatment_id: 'none' }))
                      if (errors.patient_id) setErrors(prev => ({ ...prev, patient_id: '' }))
                    }}
                    placeholder={isComprehensive ? 'ابحث عن مريض لديه علاجات غير مدفوعة...' : 'ابحث عن مريض...'}
                    emptyMessage={isComprehensive ? 'لا يوجد مرضى لديهم علاجات غير مدفوعة' : 'لا يوجد مرضى'}
                  />
                  {errors.patient_id && <p className="text-xs text-destructive">{errors.patient_id}</p>}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">العلاج</Label>
                  <Select
                    value={formData.tooth_treatment_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, tooth_treatment_id: value }))}
                    disabled={!formData.patient_id}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="اختر العلاج" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">بدون علاج</SelectItem>
                      <SelectItem value="comprehensive">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-purple-500" />
                          <span>دفعة شاملة</span>
                          {unpaidTreatments.length > 0 && (
                            <Badge variant="secondary" className="text-xs">{unpaidTreatments.length} علاج</Badge>
                          )}
                        </div>
                      </SelectItem>
                      {filteredToothTreatments.map(t => (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="text-xs">السن {t.tooth_number} - {getTreatmentNameInArabic(t.treatment_type)}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Comprehensive Payment Info */}
              {isComprehensive && unpaidTreatments.length > 0 && (
                <div className="p-4 rounded-lg bg-purple-50 border border-purple-200 dark:bg-purple-950/30 dark:border-purple-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-semibold text-purple-800 dark:text-purple-200">دفعة شاملة</span>
                    <Badge variant="outline" className="text-xs">{unpaidTreatments.length} علاج غير مدفوع</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">عدد العلاجات</p>
                      <p className="text-lg font-bold text-purple-600">{unpaidTreatments.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">إجمالي المتبقي</p>
                      <p className="text-lg font-bold text-orange-600">{formatAmount(totalUnpaidBalance)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">المبلغ المدفوع</p>
                      <p className="text-lg font-bold text-green-600">{formatAmount(getCurrentAmount())}</p>
                    </div>
                  </div>
                  <div className="text-xs text-purple-700 dark:text-purple-300">
                    سيتم توزيع المبلغ تلقائياً على العلاجات بدءاً من الأقل تكلفة
                  </div>
                </div>
              )}

              {/* Regular Treatment Info */}
              {selectedTreatment && !isComprehensive && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-xs text-muted-foreground">التكلفة:</span>
                  <span className="text-sm font-bold text-primary">{formatAmount(selectedTreatment.cost || 0)}</span>
                  {previousPayments > 0 && (
                    <>
                      <span className="text-xs text-muted-foreground">• مدفوع:</span>
                      <span className="text-xs font-medium text-orange-600">{formatAmount(previousPayments)}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Amount Section */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">المبالغ</h3>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">المبلغ <span className="text-destructive">*</span></Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max={isComprehensive && totalUnpaidBalance > 0 ? totalUnpaidBalance : undefined}
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, amount: e.target.value }))
                      if (errors.amount) setErrors(prev => ({ ...prev, amount: '' }))
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    className={`h-10 text-center font-bold ${errors.amount ? 'border-destructive' : ''}`}
                  />
                  {errors.amount && <p className="text-xs text-destructive">{errors.amount}</p>}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">الخصم</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="0.00"
                    value={formData.discount_amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, discount_amount: e.target.value }))}
                    className="h-10 text-center"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">الضريبة</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="0.00"
                    value={formData.tax_amount}
                    onChange={(e) => setFormData(prev => ({ ...prev, tax_amount: e.target.value }))}
                    className="h-10 text-center"
                  />
                </div>
              </div>

              {getTotalAmountDue() > 0 && (
                <div className={`p-4 rounded-lg border ${isFullyPaid ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' : 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800'}`}>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">الإجمالي</p>
                      <p className="text-lg font-bold">{formatAmount(getTotalAmountDue())}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">المدفوع</p>
                      <p className="text-lg font-bold text-blue-600">{formatAmount(getTotalPaid())}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">المتبقي</p>
                      <p className={`text-lg font-bold ${isFullyPaid ? 'text-green-600' : 'text-orange-600'}`}>{formatAmount(remainingBalance)}</p>
                    </div>
                  </div>
                  {isFullyPaid && (
                    <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-xs font-medium text-green-600">تم السداد بالكامل</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Payment Details */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">تفاصيل الدفع</h3>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">طريقة الدفع</Label>
                  <Select
                    value={formData.payment_method}
                    onValueChange={(value: 'cash' | 'bank_transfer') => setFormData(prev => ({ ...prev, payment_method: value }))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">نقداً</SelectItem>
                      <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">التاريخ <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, payment_date: e.target.value }))}
                    className={`h-10 ${errors.payment_date ? 'border-destructive' : ''}`}
                  />
                  {errors.payment_date && <p className="text-xs text-destructive">{errors.payment_date}</p>}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">الحالة</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: 'completed' | 'partial' | 'pending') => setFormData(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="completed">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          مكتمل
                        </div>
                      </SelectItem>
                      <SelectItem value="partial">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-orange-500" />
                          جزئي
                        </div>
                      </SelectItem>
                      <SelectItem value="pending">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          معلق
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">رقم الإيصال</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="تلقائي"
                    value={formData.receipt_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, receipt_number: e.target.value }))}
                    className="flex-1 h-10 font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData(prev => ({ ...prev, receipt_number: generateReceiptNumber() }))}
                    className="px-3"
                  >
                    <Sparkles className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            {/* Notes */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm">ملاحظات</h3>
              </div>

              <Textarea
                placeholder="وصف الدفعة (اختياري)"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
                className="resize-none"
              />
              <Textarea
                placeholder="ملاحظات إضافية (اختياري)"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Summary */}
            {getCurrentAmount() > 0 && (
              <div className="p-4 rounded-lg bg-muted/50 border space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">المبلغ:</span>
                  <span className="font-medium">{formatAmount(getCurrentAmount())}</span>
                </div>
                {getTaxAmount() > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">الضريبة:</span>
                    <span className="font-medium text-orange-600">+{formatAmount(getTaxAmount())}</span>
                  </div>
                )}
                {getDiscountAmount() > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">الخصم:</span>
                    <span className="font-medium text-green-600">-{formatAmount(getDiscountAmount())}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between">
                  <span className="font-semibold">الإجمالي:</span>
                  <Badge variant="outline" className="text-base font-bold">{formatAmount(getFinalAmount())}</Badge>
                </div>
              </div>
            )}
          </form>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/30 flex-row gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading} className="flex-1">
            إلغاء
          </Button>
          <Button type="submit" onClick={handleSubmit} disabled={isLoading || (isComprehensive && totalUnpaidBalance > 0 && (getCurrentAmount() + getTaxAmount() - getDiscountAmount()) > totalUnpaidBalance)} className="flex-1 bg-primary hover:bg-primary/90">
            {isLoading ? 'جاري الحفظ...' : isComprehensive ? 'حفظ الدفعة الشاملة' : 'حفظ الدفعة'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
