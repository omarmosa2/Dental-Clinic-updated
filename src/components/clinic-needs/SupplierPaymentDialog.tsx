import React, { useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import {
  AlertTriangle,
  Building2,
  Calculator,
  CheckCircle,
  CreditCard,
  Loader2,
  Wallet,
} from 'lucide-react'
import { useClinicNeedsStore } from '../../store/clinicNeedsStore'
import { formatCurrency } from '../../lib/utils'
import { notify } from '../../services/notificationService'
import {
  calculateClinicNeedPaymentDistribution,
  getPayableNeedsForSupplier,
  getSupplierPaymentSummary,
} from '../../utils/clinicNeedPayments'

interface SupplierPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const getLocalDateInputValue = () => {
  const date = new Date()
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().split('T')[0]
}

const SupplierPaymentDialog: React.FC<SupplierPaymentDialogProps> = ({
  open,
  onOpenChange
}) => {
  const { needs, suppliers, isLoading, applySupplierPayment } = useClinicNeedsStore()
  const [selectedSupplier, setSelectedSupplier] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(getLocalDateInputValue())
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setSelectedSupplier('')
      setPaymentAmount('')
      setPaymentDate(getLocalDateInputValue())
      setNotes('')
      setErrors({})
    }
  }, [open])

  const supplierOptions = useMemo(
    () =>
      suppliers
        .map((supplier) => ({
          supplier,
          summary: getSupplierPaymentSummary(needs, supplier)
        }))
        .filter((item) => item.summary.ordersCount > 0),
    [needs, suppliers]
  )

  const selectedSummary = useMemo(
    () => selectedSupplier ? getSupplierPaymentSummary(needs, selectedSupplier) : null,
    [needs, selectedSupplier]
  )

  const payableNeeds = useMemo(
    () => selectedSupplier ? getPayableNeedsForSupplier(needs, selectedSupplier) : [],
    [needs, selectedSupplier]
  )

  const previewAmount = parseFloat(paymentAmount) || 0
  const distributionPreview = useMemo(
    () =>
      selectedSupplier && previewAmount > 0
        ? calculateClinicNeedPaymentDistribution(needs, selectedSupplier, previewAmount)
        : [],
    [needs, selectedSupplier, previewAmount]
  )

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    const amount = parseFloat(paymentAmount)

    if (!selectedSupplier) {
      newErrors.supplier = 'يجب اختيار المستودع'
    }

    if (!paymentDate) {
      newErrors.paymentDate = 'تاريخ الدفعة مطلوب'
    }

    if (!paymentAmount.trim()) {
      newErrors.paymentAmount = 'قيمة الدفعة مطلوبة'
    } else if (Number.isNaN(amount) || amount <= 0) {
      newErrors.paymentAmount = 'قيمة الدفعة يجب أن تكون رقماً موجباً'
    } else if (selectedSummary && amount > selectedSummary.remaining) {
      newErrors.paymentAmount = `قيمة الدفعة لا يمكن أن تتجاوز الدين المتبقي (${formatCurrency(selectedSummary.remaining)})`
    }

    if (selectedSupplier && payableNeeds.length === 0) {
      newErrors.paymentAmount = 'لا توجد طلبات غير مسددة لهذا المستودع'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!validateForm()) return

    try {
      const amount = parseFloat(paymentAmount)
      const result = await applySupplierPayment({
        supplier: selectedSupplier,
        amount,
        payment_date: paymentDate,
        notes: notes.trim() || undefined
      })

      notify.success(
        `تم تسجيل دفعة ${formatCurrency(result.total_applied)} وتوزيعها على ${result.allocations.length} طلب`
      )
      onOpenChange(false)
    } catch (error) {
      console.error('Error applying supplier payment:', error)
      notify.error(error instanceof Error ? error.message : 'فشل تسجيل الدفعة')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="2xl" className="overflow-y-auto max-h-[90vh]" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center justify-end gap-2">
            <span>دفع مستودع</span>
            <CreditCard className="h-5 w-5 text-primary" />
          </DialogTitle>
          <DialogDescription className="text-right">
            تسجيل دفعة شاملة وتوزيعها تلقائياً على الطلبات غير المسددة.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="supplier" className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              <span>المستودع *</span>
            </Label>
            <Select
              value={selectedSupplier}
              onValueChange={(value) => {
                setSelectedSupplier(value)
                setPaymentAmount('')
                setErrors({})
              }}
              disabled={isLoading}
              dir="rtl"
            >
              <SelectTrigger id="supplier" className={errors.supplier ? 'border-destructive' : ''}>
                <SelectValue placeholder="اختر المستودع" />
              </SelectTrigger>
              <SelectContent>
                {supplierOptions.map(({ supplier, summary }) => (
                  <SelectItem key={supplier} value={supplier}>
                    {supplier} - متبقي: {formatCurrency(summary.remaining)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.supplier && <p className="text-sm text-destructive">{errors.supplier}</p>}
          </div>

          {selectedSummary && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">الإجمالي</p>
                <p className="text-lg font-bold">{formatCurrency(selectedSummary.total)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">المدفوع</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(selectedSummary.paid)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">الدين المتبقي</p>
                <p className="text-lg font-bold text-orange-600">{formatCurrency(selectedSummary.remaining)}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="paymentAmount" className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-green-600" />
                <span>قيمة الدفعة *</span>
              </Label>
              <Input
                id="paymentAmount"
                type="number"
                min="0"
                step="0.01"
                max={selectedSummary?.remaining || undefined}
                value={paymentAmount}
                onChange={(event) => {
                  setPaymentAmount(event.target.value)
                  if (errors.paymentAmount) {
                    setErrors((prev) => ({ ...prev, paymentAmount: '' }))
                  }
                }}
                placeholder="0.00"
                className={errors.paymentAmount ? 'border-destructive' : ''}
                disabled={isLoading || !selectedSupplier || payableNeeds.length === 0}
              />
              {errors.paymentAmount && (
                <p className="text-sm text-destructive">{errors.paymentAmount}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentDate">تاريخ الدفعة *</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(event) => {
                  setPaymentDate(event.target.value)
                  if (errors.paymentDate) {
                    setErrors((prev) => ({ ...prev, paymentDate: '' }))
                  }
                }}
                className={errors.paymentDate ? 'border-destructive' : ''}
                disabled={isLoading}
              />
              {errors.paymentDate && (
                <p className="text-sm text-destructive">{errors.paymentDate}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paymentNotes">ملاحظات</Label>
            <Textarea
              id="paymentNotes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="ملاحظات اختيارية"
              rows={2}
              disabled={isLoading}
            />
          </div>

          {distributionPreview.length > 0 && selectedSummary && previewAmount <= selectedSummary.remaining && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" />
                <span>توزيع الدفعة</span>
              </Label>
              <div className="rounded-lg border bg-muted/20 p-3 space-y-2 max-h-48 overflow-y-auto">
                {distributionPreview.map((item) => (
                  <div key={item.need.id} className="flex items-center justify-between gap-3 border-b last:border-0 py-2">
                    <div>
                      <p className="font-medium">{item.need.need_name}</p>
                      <p className="text-xs text-muted-foreground">
                        المتبقي قبل الدفع: {formatCurrency(item.remaining)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-green-600 font-semibold">
                      <span>{formatCurrency(item.applied)}</span>
                      {item.willBeFullyPaid && <CheckCircle className="h-4 w-4" />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedSupplier && payableNeeds.length === 0 && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-green-800 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm">جميع طلبات هذا المستودع مدفوعة بالكامل.</span>
            </div>
          )}

          {!selectedSupplier && supplierOptions.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">لا توجد مستودعات مسجلة داخل الطلبات الحالية.</span>
            </div>
          )}

          <DialogFooter className="flex flex-row-reverse gap-2">
            <Button
              type="submit"
              variant="success"
              disabled={isLoading || !selectedSupplier || payableNeeds.length === 0}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جار التسجيل...
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  تسجيل الدفعة
                </>
              )}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              إلغاء
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default SupplierPaymentDialog
