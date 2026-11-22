import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from '@/components/ui/alert-dialog'
import { useCurrency } from '@/contexts/CurrencyContext'
import { finalAmount } from '@/services/paymentCore.mjs'
import { CreditCard, Loader2 } from 'lucide-react'

export default function FullPaymentButton({ amount, disabled, onConfirm }: {
  amount: number
  disabled?: boolean
  onConfirm: (method: 'cash' | 'bank_transfer') => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [method, setMethod] = useState<'cash' | 'bank_transfer'>('cash')
  const guard = useRef(false)
  const { formatAmount } = useCurrency()
  let valid = false
  try { valid = finalAmount(amount) > 0 } catch { /* Invalid costs disable payment. */ }
  const confirm = async () => {
    if (guard.current || !valid) return
    guard.current = true
    setBusy(true)
    setError('')
    try { await onConfirm(method); setOpen(false) }
    catch (error) { setError(error instanceof Error ? error.message : 'فشل تسجيل الدفع الكامل') }
    finally { guard.current = false; setBusy(false) }
  }
  return <>
    <Button
      type="button"
      variant="success"
      className="h-12 w-full gap-2 rounded-xl px-5 font-semibold shadow-green-600/20 disabled:opacity-60 sm:w-auto sm:shrink-0"
      disabled={disabled || busy || !valid}
      onClick={() => setOpen(true)}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CreditCard className="h-4 w-4" aria-hidden="true" />}
      دفع كامل المبلغ فوراً
    </Button>
    <AlertDialog open={open} onOpenChange={value => { if (!busy) setOpen(value) }}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>تأكيد دفع كامل المبلغ</AlertDialogTitle>
          <AlertDialogDescription>
            هل أنت متأكد من تسجيل كامل تكلفة هذا العلاج كدفعة مدفوعة للمريض؟
            <br />سيتم إنشاء دفعة مالية بقيمة {formatAmount(amount)}، واحتساب العلاج كمدفوع بالكامل، وإضافة الدفعة إلى السجل المالي للمريض.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <label className="space-y-2">طريقة الدفع
          <select className="w-full rounded-md border bg-background p-2" value={method} disabled={busy} onChange={e => setMethod(e.target.value as typeof method)}>
            <option value="cash">نقداً</option><option value="bank_transfer">تحويل بنكي</option>
          </select>
        </label>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>إلغاء</AlertDialogCancel>
          <Button type="button" disabled={busy || !valid} onClick={confirm}>تأكيد الدفع الكامل</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
}
