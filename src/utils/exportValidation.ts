import { sumPayments, summarizePaymentBalances, money } from '@/services/paymentCore.mjs'
import { Payment, Appointment, InventoryItem } from '@/types'

/**
 * أدوات التحقق من صحة البيانات المصدرة
 * للتأكد من دقة 100% في جميع الحسابات
 */
export class ExportValidation {

  /**
   * التحقق من صحة حسابات المدفوعات
   */
  static validatePaymentCalculations(payments: Payment[]) {
    const totalRevenue = sumPayments(payments)
    const completedAmount = sumPayments(payments.filter(p=>p.status==='completed' || p.status==='paid'))
    const partialAmount = sumPayments(payments.filter(p=>p.status==='partial'))
    const pendingAmount = summarizePaymentBalances(payments).pendingBalance
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate()-30)
    const overdueIds = new Set(payments.filter(p=>p.status==='pending' && new Date(p.payment_date)<cutoff).map(p=>p.tooth_treatment_id || p.appointment_id || p.id))
    const overdueAmount = summarizePaymentBalances(payments.filter(p=>overdueIds.has(p.tooth_treatment_id || p.appointment_id || p.id))).pendingBalance
    return {totalRevenue,completedAmount,partialAmount,pendingAmount,overdueAmount,isValid:money(completedAmount+partialAmount)===totalRevenue}
  }

  /**
   * التحقق من صحة إحصائيات المواعيد
   */
  static validateAppointmentStats(appointments: Appointment[]) {
    const total = appointments.length
    const completed = appointments.filter(a => a.status === 'completed').length
    const cancelled = appointments.filter(a => a.status === 'cancelled').length
    const noShow = appointments.filter(a => a.status === 'no-show').length
    const scheduled = appointments.filter(a => a.status === 'scheduled').length

    // التحقق من أن المجموع صحيح
    const calculatedTotal = completed + cancelled + noShow + scheduled
    const otherStatuses = total - calculatedTotal

    if (otherStatuses !== 0) {
      console.warn('Appointment status calculation mismatch:', {
        total,
        calculatedTotal,
        otherStatuses,
        statusBreakdown: { completed, cancelled, noShow, scheduled }
      })
    }

    const attendanceRate = total > 0 ? Math.round((completed / total) * 100) : 0

    return {
      total,
      completed,
      cancelled,
      noShow,
      scheduled,
      attendanceRate,
      isValid: otherStatuses === 0
    }
  }

  /**
   * التحقق من صحة إحصائيات المخزون
   */
  static validateInventoryStats(inventory: InventoryItem[]) {
    const totalItems = inventory.length
    const totalValue = inventory.reduce((sum, item) => {
      const itemValue = (item.unit_price || 0) * (item.quantity || 0)
      return sum + itemValue
    }, 0)

    const lowStockItems = inventory.filter(item =>
      (item.quantity || 0) <= (item.minimum_stock || 0) && (item.quantity || 0) > 0
    ).length

    const outOfStockItems = inventory.filter(item =>
      (item.quantity || 0) === 0
    ).length

    const inStockItems = inventory.filter(item =>
      (item.quantity || 0) > (item.minimum_stock || 0)
    ).length

    // التحقق من أن المجموع صحيح
    const calculatedTotal = lowStockItems + outOfStockItems + inStockItems

    if (calculatedTotal !== totalItems) {
      console.warn('Inventory calculation mismatch:', {
        totalItems,
        calculatedTotal,
        breakdown: { lowStockItems, outOfStockItems, inStockItems }
      })
    }

    return {
      totalItems,
      totalValue: Math.round(totalValue * 100) / 100,
      lowStockItems,
      outOfStockItems,
      inStockItems,
      isValid: calculatedTotal === totalItems
    }
  }

  /**
   * التحقق الشامل من صحة جميع البيانات
   */
  static validateAllData(data: {
    payments: Payment[]
    appointments: Appointment[]
    inventory: InventoryItem[]
  }) {
    const paymentValidation = this.validatePaymentCalculations(data.payments)
    const appointmentValidation = this.validateAppointmentStats(data.appointments)
    const inventoryValidation = this.validateInventoryStats(data.inventory)

    const isAllValid = paymentValidation.isValid &&
                      appointmentValidation.isValid &&
                      inventoryValidation.isValid

    if (!isAllValid) {
      console.error('Data validation failed:', {
        payments: paymentValidation.isValid,
        appointments: appointmentValidation.isValid,
        inventory: inventoryValidation.isValid
      })
    }

    return {
      payments: paymentValidation,
      appointments: appointmentValidation,
      inventory: inventoryValidation,
      isAllValid
    }
  }

  /**
   * مقارنة البيانات المفلترة مع البيانات الأصلية
   */
  static compareFilteredData(original: any[], filtered: any[], filterDescription: string) {
    const originalCount = original.length
    const filteredCount = filtered.length
    const filterRatio = originalCount > 0 ? (filteredCount / originalCount) * 100 : 0

    console.log(`Filter comparison for ${filterDescription}:`, {
      original: originalCount,
      filtered: filteredCount,
      ratio: `${Math.round(filterRatio)}%`,
      isFiltered: filteredCount < originalCount
    })

    return {
      originalCount,
      filteredCount,
      filterRatio: Math.round(filterRatio),
      isFiltered: filteredCount < originalCount
    }
  }
}

/**
 * دالة مساعدة للتحقق من صحة البيانات قبل التصدير
 */
export function validateBeforeExport(data: {
  payments: Payment[]
  appointments: Appointment[]
  inventory: InventoryItem[]
  filterInfo?: any
}): boolean {
  console.log('🔍 Validating data before export...')

  const validation = ExportValidation.validateAllData(data)

  if (!validation.isAllValid) {
    console.error('❌ Data validation failed! Export may contain incorrect values.')
    return false
  }

  console.log('✅ Data validation passed! Export will contain accurate values.')

  if (data.filterInfo) {
    console.log('📊 Filter information:', data.filterInfo)
  }

  return true
}
