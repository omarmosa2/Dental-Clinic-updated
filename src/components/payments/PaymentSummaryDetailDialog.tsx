import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { AlertTriangle, Clock, DollarSign, Loader2, Users } from 'lucide-react'
import type { PaymentSummaryDetailRecord } from '@/types'

type PaymentSummaryDialogType = 'unpaid' | 'remaining' | 'paid'

interface PaymentSummaryDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: PaymentSummaryDialogType | null
  title: string
  data: PaymentSummaryDetailRecord[]
  isLoading: boolean
}

const getStatusBadge = (status: string, type: PaymentSummaryDialogType) => {
  const normalized = (status || '').toLowerCase()

  if (type === 'paid') {
    return (
      <Badge className="min-w-20 justify-center whitespace-nowrap border-emerald-200 bg-emerald-100 px-3 py-1 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
        مدفوع
      </Badge>
    )
  }

  if (type === 'unpaid') {
    if (normalized === 'unpaid' || normalized === 'pending') {
      return (
        <Badge className="min-w-20 justify-center whitespace-nowrap border-red-200 bg-red-100 px-3 py-1 text-red-700 dark:border-red-700 dark:bg-red-900/30 dark:text-red-300">
          غير مدفوع
        </Badge>
      )
    }

    return (
      <Badge className="min-w-20 justify-center whitespace-nowrap border-orange-200 bg-orange-100 px-3 py-1 text-orange-700 dark:border-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
        جزئي
      </Badge>
    )
  }

  return (
    <Badge className="min-w-20 justify-center whitespace-nowrap border-yellow-200 bg-yellow-100 px-3 py-1 text-yellow-700 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
      متبقي
    </Badge>
  )
}

export default function PaymentSummaryDetailDialog({
  open,
  onOpenChange,
  type,
  title,
  data,
  isLoading
}: PaymentSummaryDetailDialogProps) {
  const summary = data.reduce(
    (acc, row) => ({
      total: acc.total + Number(row.total_amount || 0),
      paid: acc.paid + Number(row.amount_paid || 0),
      remaining: acc.remaining + Number(row.remaining_balance || 0)
    }),
    { total: 0, paid: 0, remaining: 0 }
  )
  const HeaderIcon = type === 'paid' ? DollarSign : type === 'remaining' ? Clock : AlertTriangle

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="full"
        className="w-[min(94vw,820px)] max-w-[820px] max-h-[86vh] gap-0 overflow-hidden rounded-2xl border-border bg-background p-0 shadow-2xl sm:max-w-[820px] sm:max-h-[86vh] sm:gap-0 sm:p-0 md:max-w-[820px] lg:max-w-[820px]"
        dir="rtl"
      >
        <div className="border-b border-border/70 bg-muted/20 px-5 pb-4 pl-14 pt-5 text-right sm:px-6 sm:pl-16 sm:pt-6">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <HeaderIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-right text-xl font-bold leading-8 text-foreground sm:text-2xl">
                {title}
              </DialogTitle>
              <DialogDescription className="mt-1 text-right text-sm leading-6 text-muted-foreground sm:text-base">
                {type === 'paid'
                  ? 'عرض ملخص المبالغ المدفوعة حسب المرضى'
                  : type === 'unpaid'
                  ? 'عرض المرضى الذين لديهم مبالغ غير مدفوعة'
                  : 'عرض المرضى الذين لديهم مبالغ متبقية أو أقساط'}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="space-y-4 overflow-hidden p-4 sm:p-6">
          {!isLoading && data.length > 0 && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border bg-card px-4 py-3">
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Users className="h-4 w-4" />
                  عدد المرضى
                </div>
                <p className="mt-2 text-lg font-bold text-foreground">{data.length}</p>
              </div>
              <div className="rounded-lg border border-border bg-card px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground">الإجمالي</p>
                <p className="mt-2 text-left text-lg font-bold text-foreground" dir="ltr">
                  {formatCurrency(summary.total)}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-card px-4 py-3">
                <p className="text-xs font-medium text-muted-foreground">المدفوع</p>
                <p className="mt-2 text-left text-lg font-bold text-emerald-600 dark:text-emerald-400" dir="ltr">
                  {formatCurrency(summary.paid)}
                </p>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-border bg-card">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">جاري تحميل البيانات...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              لا توجد بيانات للعرض
            </div>
          ) : (
            <div className="max-h-[52vh] overflow-auto">
              <table className="w-full min-w-[680px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[18%]" />
                  <col className="w-[18%]" />
                  <col className="w-[18%]" />
                  <col className="w-[18%]" />
                </colgroup>
                <thead className="bg-muted/60 sticky top-0 z-10">
                  <tr className="text-right">
                    <th className="px-5 py-3.5 font-semibold text-foreground">المريض</th>
                    {/* <th className="px-4 py-3 font-medium">الخدمة/العلاج</th> */}
                    <th className="px-5 py-3.5 text-left font-semibold text-foreground">الإجمالي</th>
                    <th className="px-5 py-3.5 text-left font-semibold text-foreground">المدفوع</th>
                    <th className="px-5 py-3.5 text-left font-semibold text-foreground">المتبقي</th>
                    {/* <th className="px-4 py-3 font-medium">الاستحقاق</th> */}
                    {/* <th className="px-4 py-3 font-medium">طريقة الدفع</th> */}
                    <th className="px-5 py-3.5 text-center font-semibold text-foreground">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((row, index) => (
                    <tr
                      key={`${row.patient_id}-${row.reference_id}-${index}`}
                      className="border-t border-border hover:bg-muted/40 transition-colors"
                    >
                      <td className="px-5 py-4 font-semibold text-foreground">
                        <span className="block truncate">{row.patient_name}</span>
                      </td>
                      {/* <td className="px-4 py-3 text-muted-foreground">{row.treatment_name || '-'}</td> */}
                      <td className="px-5 py-4 text-left tabular-nums" dir="ltr">{formatCurrency(row.total_amount || 0)}</td>
                      <td className="px-5 py-4 text-left tabular-nums" dir="ltr">{formatCurrency(row.amount_paid || 0)}</td>
                      <td className="px-5 py-4 text-left font-bold tabular-nums text-foreground" dir="ltr">{formatCurrency(row.remaining_balance || 0)}</td>
                      {/* <td className="px-4 py-3 text-muted-foreground">
                        {row.next_due_date ? formatDate(row.next_due_date) : '-'}
                      </td> */}
                      {/* <td className="px-4 py-3 text-muted-foreground">{row.payment_method || '-'}</td> */}
                      <td className="px-5 py-4 text-center">{getStatusBadge(row.status || '', type || 'unpaid')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
