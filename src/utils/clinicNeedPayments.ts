import type { ClinicNeed, ClinicNeedPaymentStatus } from '@/types'

const MONEY_PRECISION = 100

export const roundMoney = (amount: number) =>
  Math.round((Number(amount) || 0) * MONEY_PRECISION) / MONEY_PRECISION

export const getClinicNeedTotal = (need: Pick<ClinicNeed, 'price' | 'quantity'>) =>
  roundMoney((Number(need.price) || 0) * (Number(need.quantity) || 0))

export const getClinicNeedPaid = (need: ClinicNeed) => {
  const total = getClinicNeedTotal(need)
  return Math.min(total, Math.max(0, roundMoney(need.paid_amount || 0)))
}

export const getClinicNeedRemaining = (need: ClinicNeed) => {
  const total = getClinicNeedTotal(need)
  const fallbackRemaining = total - getClinicNeedPaid(need)
  const storedRemaining =
    need.remaining_balance === undefined || need.remaining_balance === null
      ? fallbackRemaining
      : Number(need.remaining_balance)

  return Math.min(total, Math.max(0, roundMoney(storedRemaining)))
}

export const getClinicNeedPaymentStatus = (need: ClinicNeed): ClinicNeedPaymentStatus => {
  const remaining = getClinicNeedRemaining(need)
  const paid = getClinicNeedPaid(need)

  if (remaining <= 0) return 'paid'
  if (paid > 0) return 'partial'
  return 'unpaid'
}

export const getPaymentStatusLabel = (status: ClinicNeedPaymentStatus) => {
  const labels: Record<ClinicNeedPaymentStatus, string> = {
    paid: 'مدفوع',
    partial: 'مدفوع جزئياً',
    unpaid: 'غير مدفوع'
  }

  return labels[status]
}

export const getPayableNeedsForSupplier = (needs: ClinicNeed[], supplier: string) =>
  needs
    .filter((need) => (need.supplier || '').trim() === supplier.trim())
    .map((need) => ({
      ...need,
      calculatedRemaining: getClinicNeedRemaining(need)
    }))
    .filter((need) => need.calculatedRemaining > 0)
    .sort((a, b) => {
      if (a.calculatedRemaining !== b.calculatedRemaining) {
        return a.calculatedRemaining - b.calculatedRemaining
      }

      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    })

export const getSupplierPaymentSummary = (needs: ClinicNeed[], supplier: string) => {
  const supplierNeeds = needs.filter((need) => (need.supplier || '').trim() === supplier.trim())
  const total = supplierNeeds.reduce((sum, need) => sum + getClinicNeedTotal(need), 0)
  const paid = supplierNeeds.reduce((sum, need) => sum + getClinicNeedPaid(need), 0)
  const remaining = supplierNeeds.reduce((sum, need) => sum + getClinicNeedRemaining(need), 0)

  return {
    total: roundMoney(total),
    paid: roundMoney(paid),
    remaining: roundMoney(remaining),
    ordersCount: supplierNeeds.length,
    unpaidOrdersCount: supplierNeeds.filter((need) => getClinicNeedRemaining(need) > 0).length
  }
}

export const calculateClinicNeedPaymentDistribution = (
  needs: ClinicNeed[],
  supplier: string,
  amount: number
) => {
  const payableNeeds = getPayableNeedsForSupplier(needs, supplier)
  const preview: Array<{
    need: ClinicNeed
    remaining: number
    applied: number
    willBeFullyPaid: boolean
  }> = []
  let paymentLeft = roundMoney(amount)

  for (const need of payableNeeds) {
    if (paymentLeft <= 0) break

    const applied = Math.min(need.calculatedRemaining, paymentLeft)
    preview.push({
      need,
      remaining: need.calculatedRemaining,
      applied: roundMoney(applied),
      willBeFullyPaid: roundMoney(applied) >= need.calculatedRemaining
    })

    paymentLeft = roundMoney(paymentLeft - applied)
  }

  return preview
}
