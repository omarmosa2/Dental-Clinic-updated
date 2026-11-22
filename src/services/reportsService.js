const { getRevenueTransactionAmount, isRevenuePaymentStatus, sumPayments, summarizePaymentBalances, money } = require('./paymentCore.mjs')
class ReportsService {

  // Helper function to get Arabic treatment name
  getTreatmentNameInArabic(treatmentType) {
    const treatmentMap = {
      // Preventive treatments
      'healthy': 'سليم',
      'cleaning': 'تنظيف',
      'fluoride': 'فلورايد',
      'sealant': 'حشو وقائي',
      'scaling': 'تقليح',

      // Restorative treatments
      'filling_metal': 'حشو معدني',
      'filling_cosmetic': 'حشو تجميلي',
      'filling_glass_ionomer': 'حشو زجاجي',
      'inlay': 'حشو داخلي',
      'onlay': 'حشو خارجي',

      // Endodontic treatments
      'pulp_therapy': 'مداولة لبية',
      'direct_pulp_cap': 'تغطية مباشرة',
      'indirect_pulp_cap': 'تغطية غير مباشرة',
      'retreatment': 'إعادة معالجة',
      'deep_pulp_treatment': 'معالجة لبية عفنة',

      // Surgical treatments
      'extraction_simple': 'قلع بسيط',
      'extraction_surgical': 'قلع جراحي',
      'implant': 'زراعة',
      'bone_graft': 'ترقيع عظم',
      'sinus_lift': 'رفع الجيب الفكي',
      'gum_surgery': 'جراحة لثة',
      'apical_resection': 'قطع ذروة',

      // Cosmetic treatments
      'veneer_porcelain': 'قشرة خزفية',
      'veneer_composite': 'قشرة مركبة',
      'whitening': 'تبييض',
      'bonding': 'ربط تجميلي',
      'contouring': 'تشكيل تجميلي',
      'polish': 'بوليش',

      // Orthodontic treatments
      'orthodontic_metal': 'تقويم معدني',
      'orthodontic_ceramic': 'تقويم خزفي',
      'orthodontic_clear': 'تقويم شفاف',
      'retainer': 'مثبت',
      'space_maintainer': 'حافظ مسافة',

      // Periodontal treatments
      'scaling_periodontal': 'تقليح',
      'subgingival_scaling': 'تقليح تحت لثوي',
      'deep_cleaning': 'تنظيف عميق',
      'root_planing': 'تسوية الجذور',
      'gum_graft': 'ترقيع لثة',
      'pocket_reduction': 'تقليل الجيوب',

      // Pediatric treatments
      'pediatric_filling': 'حشوة',
      'pulp_amputation': 'بتر لب',
      'pediatric_pulp_treatment': 'معالجة لبية',
      'pulp_therapy_pediatric': 'علاج عصب لبني',
      'stainless_crown': 'تاج ستانلس',
      'space_maintainer_fixed': 'حافظ مسافة ثابت',
      'space_maintainer_removable': 'حافظ مسافة متحرك',

      // Prosthetic treatments
      'crown_metal': 'تاج معدني',
      'crown_ceramic': 'تاج خزفي',
      'crown_zirconia': 'تاج زيركونيا',
      'bridge': 'جسر',

      // Legacy treatments
      'preventive': 'علاج وقائي',
      'pulp_cap': 'تغطية لب',
      'orthodontic_metal': 'تقويم معدني',
      'extraction_simple': 'قلع بسيط'
    }

    return treatmentMap[treatmentType] || treatmentType
  }

  // Helper function to get Arabic category name
  getCategoryNameInArabic(category) {
    // If category is already in Arabic, return it
    if (category && (category.includes('العلاجات') || category.includes('علاج') || category.includes('التعويضات'))) {
      return category
    }

    // Map English categories to Arabic
    const categoryMap = {
      'preventive': 'العلاجات الوقائية',
      'restorative': 'الترميمية (المحافظة)',
      'endodontic': 'علاج العصب',
      'surgical': 'العلاجات الجراحية',
      'cosmetic': 'العلاجات التجميلية',
      'orthodontic': 'علاجات التقويم',
      'periodontal': 'علاجات اللثة',
      'pediatric': 'علاجات الأطفال',
      'prosthetic': 'التعويضات'
    }

    return categoryMap[category] || category
  }

  // Helper function to filter data by date range
  filterByDateRange(data, dateRange, dateField = 'created_at') {
    const start = new Date(dateRange.start)
    const end = new Date(dateRange.end)
    end.setHours(23, 59, 59, 999) // Include the entire end date

    return data.filter(item => {
      const itemDate = new Date(item[dateField])
      return itemDate >= start && itemDate <= end
    })
  }

  // Helper function to calculate age from date of birth
  calculateAge(dateOfBirth) {
    const today = new Date()
    const birthDate = new Date(dateOfBirth)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }

    return age
  }

  // Helper function to group data by time period
  groupByPeriod(data, period = 'month', dateField = 'created_at') {
    const groups = {}

    data.forEach(item => {
      const date = new Date(item[dateField])
      let key

      switch (period) {
        case 'day':
          key = date.toISOString().split('T')[0]
          break
        case 'week':
          const weekStart = new Date(date)
          weekStart.setDate(date.getDate() - date.getDay())
          key = weekStart.toISOString().split('T')[0]
          break
        case 'month':
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
          break
        case 'year':
          key = String(date.getFullYear())
          break
        default:
          key = date.toISOString().split('T')[0]
      }

      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(item)
    })

    return Object.entries(groups)
      .map(([period, data]) => ({ period, count: data.length, data }))
      .sort((a, b) => a.period.localeCompare(b.period))
  }

  calculateAgeDistribution(patients) {
    const ageGroups = {
      '0-17': 0,
      '18-30': 0,
      '31-45': 0,
      '46-60': 0,
      '60+': 0,
      'غير محدد': 0
    }

    patients.forEach(patient => {
      // استخدام حقل العمر مباشرة من قاعدة البيانات
      if (!patient.age || typeof patient.age !== 'number') {
        ageGroups['غير محدد']++
        return
      }

      const age = patient.age

      if (age >= 0 && age <= 17) {
        ageGroups['0-17']++
      } else if (age >= 18 && age <= 30) {
        ageGroups['18-30']++
      } else if (age >= 31 && age <= 45) {
        ageGroups['31-45']++
      } else if (age >= 46 && age <= 60) {
        ageGroups['46-60']++
      } else if (age > 60) {
        ageGroups['60+']++
      } else {
        ageGroups['غير محدد']++
      }
    })

    // فقط إرجاع الفئات العمرية التي لديها مرضى فعلاً
    return Object.entries(ageGroups)
      .filter(([ageGroup, count]) => count > 0)
      .map(([ageGroup, count]) => ({ ageGroup, count }))
  }

  calculateGenderDistribution(patients) {
    const genderCounts = {
      'male': 0,
      'female': 0,
      'غير محدد': 0
    }

    patients.forEach(patient => {
      if (!patient.gender) {
        genderCounts['غير محدد']++
        return
      }

      if (patient.gender === 'male') {
        genderCounts['male']++
      } else if (patient.gender === 'female') {
        genderCounts['female']++
      } else {
        genderCounts['غير محدد']++
      }
    })

    // فقط إرجاع الأجناس التي لديها مرضى فعلاً
    const result = []
    if (genderCounts['male'] > 0) {
      result.push({ gender: 'ذكر', count: genderCounts['male'] })
    }
    if (genderCounts['female'] > 0) {
      result.push({ gender: 'أنثى', count: genderCounts['female'] })
    }
    if (genderCounts['غير محدد'] > 0) {
      result.push({ gender: 'غير محدد', count: genderCounts['غير محدد'] })
    }

    return result
  }

  // Helper function to group data by a field or function
  groupBy(data, keyOrFunction) {
    const groups = {}

    data.forEach(item => {
      let key
      if (typeof keyOrFunction === 'function') {
        key = keyOrFunction(item)
      } else {
        key = item[keyOrFunction]
      }

      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(item)
    })

    return Object.entries(groups).map(([key, items]) => ({
      key,
      items,
      count: items.length
    }))
  }

  // Generate Patient Reports
  async generatePatientReport(patients, appointments, filter) {
    const filteredPatients = this.filterByDateRange(patients, filter.dateRange)

    // Calculate basic stats
    const totalPatients = patients.length
    const newPatients = filteredPatients.length

    // Calculate active/inactive patients based on recent appointments
    const threeMonthsAgo = new Date()
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

    const recentAppointments = appointments.filter(apt =>
      new Date(apt.created_at) >= threeMonthsAgo
    )
    const activePatientIds = new Set(recentAppointments.map(apt => apt.patient_id))

    const activePatients = patients.filter(p => activePatientIds.has(p.id)).length
    const inactivePatients = totalPatients - activePatients

    // Age distribution
    const ageDistribution = this.calculateAgeDistribution(patients)

    // Gender distribution - calculate from actual patient data
    const genderDistribution = this.calculateGenderDistribution(patients)

    // Registration trend
    const registrationTrend = this.groupByPeriod(filteredPatients, 'month')
      .map(group => ({ period: group.period, count: group.count }))

    return {
      totalPatients,
      newPatients,
      activePatients,
      inactivePatients,
      ageDistribution,
      genderDistribution,
      registrationTrend,
      patientsList: filteredPatients
    }
  }

  // Generate Appointment Reports
  async generateAppointmentReport(appointments, treatments, filter) {
    const filteredAppointments = this.filterByDateRange(appointments, filter.dateRange, 'start_time')

    // Basic stats
    const totalAppointments = filteredAppointments.length
    const completedAppointments = filteredAppointments.filter(apt => apt.status === 'completed').length
    const cancelledAppointments = filteredAppointments.filter(apt => apt.status === 'cancelled').length
    const noShowAppointments = filteredAppointments.filter(apt => apt.status === 'no_show').length
    const scheduledAppointments = filteredAppointments.filter(apt => apt.status === 'scheduled').length

    // Calculate rates
    const attendanceRate = totalAppointments > 0 ? (completedAppointments / totalAppointments) * 100 : 0
    const cancellationRate = totalAppointments > 0 ? (cancelledAppointments / totalAppointments) * 100 : 0

    // Appointments by status
    const appointmentsByStatus = [
      { status: 'مكتمل', count: completedAppointments, percentage: (completedAppointments / totalAppointments) * 100 },
      { status: 'مجدول', count: scheduledAppointments, percentage: (scheduledAppointments / totalAppointments) * 100 },
      { status: 'ملغي', count: cancelledAppointments, percentage: (cancelledAppointments / totalAppointments) * 100 },
      { status: 'لم يحضر', count: noShowAppointments, percentage: (noShowAppointments / totalAppointments) * 100 }
    ]

    // Appointments by treatment
    const treatmentCounts = {}
    filteredAppointments.forEach(apt => {
      const treatment = treatments.find(t => t.id === apt.treatment_id)
      const treatmentName = treatment?.name || 'غير محدد'
      treatmentCounts[treatmentName] = (treatmentCounts[treatmentName] || 0) + 1
    })

    const appointmentsByTreatment = Object.entries(treatmentCounts)
      .map(([treatment, count]) => ({ treatment, count }))
      .sort((a, b) => b.count - a.count)

    // Appointments by day of week
    const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    const dayCounts = {}

    filteredAppointments.forEach(apt => {
      const date = new Date(apt.start_time)
      const dayName = dayNames[date.getDay()]
      dayCounts[dayName] = (dayCounts[dayName] || 0) + 1
    })

    const appointmentsByDay = dayNames.map(day => ({
      day,
      count: dayCounts[day] || 0
    }))

    // Appointments by hour (peak hours analysis)
    const hourCounts = {}
    filteredAppointments.forEach(apt => {
      const date = new Date(apt.start_time)
      const hour = `${date.getHours()}:00`
      hourCounts[hour] = (hourCounts[hour] || 0) + 1
    })

    const appointmentsByHour = Object.entries(hourCounts)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour))

    const peakHours = Object.entries(hourCounts)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Appointment trend
    const appointmentTrend = this.groupByPeriod(filteredAppointments, 'month', 'start_time')
      .map(group => ({ period: group.period, count: group.count }))

    return {
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      noShowAppointments,
      scheduledAppointments,
      attendanceRate,
      cancellationRate,
      appointmentsByStatus,
      appointmentsByTreatment,
      appointmentsByDay,
      appointmentsByHour,
      peakHours,
      appointmentTrend,
      appointmentsList: filteredAppointments
    }
  }

  // Generate Financial Reports with Expenses Integration
  async generateFinancialReport(payments, treatments, filter, expenses = []) {
    const filteredPayments = this.filterByDateRange(payments, filter.dateRange, 'payment_date')
    const filteredExpenses = this.filterByDateRange(expenses, filter.dateRange, 'payment_date')

    // Validation function
    const validateAmount = (amount) => {
      const num = Number(amount)
      return isNaN(num) || !isFinite(num) ? 0 : Math.round(num * 100) / 100
    }

    // Basic financial stats - include both completed and partial payments
    const totalRevenue = sumPayments(filteredPayments)

    const totalPaid = sumPayments(filteredPayments)

    const totalPending = summarizePaymentBalances(filteredPayments).pendingBalance

    const totalOverdue = filteredPayments
      .filter(p => p.status === 'overdue')
      .reduce((sum, p) => sum + validateAmount(p.remaining_balance || p.amount), 0)

    // Calculate total expenses
    const totalExpenses = filteredExpenses
      .filter(e => e.status === 'paid')
      .reduce((sum, e) => sum + validateAmount(e.amount), 0)

    // Revenue by payment method
    const paymentMethodCounts = {}
    const paymentMethodNames = {
      'cash': 'نقدي',
      'card': 'بطاقة',
      'bank_transfer': 'تحويل بنكي',
      'check': 'شيك',
      'insurance': 'تأمين'
    }

    filteredPayments
      .filter(p => isRevenuePaymentStatus(p.status))
      .forEach(payment => {
        const method = paymentMethodNames[payment.payment_method] || payment.payment_method
        paymentMethodCounts[method] = money((paymentMethodCounts[method] || 0) + getRevenueTransactionAmount(payment))
      })

    const revenueByPaymentMethod = Object.entries(paymentMethodCounts)
      .map(([method, amount]) => ({
        method,
        amount,
        percentage: totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount)

    // Revenue by treatment
    const treatmentRevenue = {}

    filteredPayments
      .filter(p => isRevenuePaymentStatus(p.status) && p.appointment?.treatment_id)
      .forEach(payment => {
        const treatment = treatments.find(t => t.id === payment.appointment?.treatment_id)
        const treatmentName = treatment?.name || 'غير محدد'

        if (!treatmentRevenue[treatmentName]) {
          treatmentRevenue[treatmentName] = { amount: 0, count: 0 }
        }

        treatmentRevenue[treatmentName].amount = money(treatmentRevenue[treatmentName].amount + getRevenueTransactionAmount(payment))
        treatmentRevenue[treatmentName].count += 1
      })

    const revenueByTreatment = Object.entries(treatmentRevenue)
      .map(([treatment, data]) => ({
        treatment,
        amount: data.amount,
        count: data.count,
        avgAmount: data.count > 0 ? data.amount / data.count : 0
      }))
      .sort((a, b) => b.amount - a.amount)

    // Revenue trend
    const revenueTrend = this.groupByPeriod(
      filteredPayments.filter(p => isRevenuePaymentStatus(p.status)),
      'month',
      'payment_date'
    ).map(group => ({
      period: group.period,
      amount: sumPayments(group.data)
    }))

    // Calculate expenses by type
    const expensesByType = this.groupBy(filteredExpenses.filter(e => e.status === 'paid'), 'expense_type')
      .map(group => ({
        type: group.key || 'غير محدد',
        amount: group.items.reduce((sum, e) => sum + validateAmount(e.amount), 0),
        count: group.items.length,
        percentage: 0 // Will be calculated below
      }))

    // Calculate percentages for expenses
    expensesByType.forEach(item => {
      item.percentage = totalExpenses > 0 ? (item.amount / totalExpenses) * 100 : 0
    })

    // Expense trend
    const expenseTrend = this.groupByPeriod(
      filteredExpenses.filter(e => e.status === 'paid'),
      'month',
      'payment_date'
    ).map(group => ({
      period: group.period,
      amount: group.data.reduce((sum, e) => sum + validateAmount(e.amount), 0)
    }))

    // Enhanced cash flow with expenses
    const cashFlow = revenueTrend.map(item => {
      const expenseForPeriod = expenseTrend.find(e => e.period === item.period)?.amount || 0
      return {
        period: item.period,
        income: item.amount,
        expenses: expenseForPeriod,
        net: item.amount - expenseForPeriod
      }
    })

    // Outstanding payments
    const outstandingPayments = payments
      .filter(p => ['pending', 'overdue', 'partial'].includes(p.status) && (p.remaining_balance ?? p.treatment_remaining_balance ?? p.appointment_remaining_balance ?? 0) > 0)
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
      .slice(0, 20) // Top 20 outstanding payments

    // Recent transactions
    const recentTransactions = filteredPayments
      .filter(p => isRevenuePaymentStatus(p.status))
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
      .slice(0, 10) // Last 10 transactions

    // Recent expenses
    const recentExpenses = filteredExpenses
      .filter(e => e.status === 'paid')
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())
      .slice(0, 10) // Last 10 expenses

    // Profit/Loss calculation
    const netProfit = totalRevenue - totalExpenses
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
    const expenseRatio = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0

    // Financial health indicators
    const profitTrend = this.calculateProfitTrend(cashFlow)
    const cashFlowStatus = netProfit > 0 ? 'positive' : netProfit < 0 ? 'negative' : 'neutral'

    return {
      totalRevenue,
      totalPaid,
      totalPending,
      totalOverdue,
      totalExpenses,
      netProfit,
      profitMargin,
      expenseRatio,
      profitTrend,
      cashFlowStatus,
      revenueByPaymentMethod,
      revenueByTreatment,
      expensesByType,
      revenueTrend,
      expenseTrend,
      cashFlow,
      outstandingPayments,
      recentTransactions,
      recentExpenses
    }
  }

  // Calculate profit trend based on cash flow data
  calculateProfitTrend(cashFlow) {
    if (cashFlow.length < 2) return 'stable'

    const recentPeriods = cashFlow.slice(-3) // Last 3 periods
    if (recentPeriods.length < 2) return 'stable'

    let increasingCount = 0
    let decreasingCount = 0

    for (let i = 1; i < recentPeriods.length; i++) {
      const current = recentPeriods[i].net
      const previous = recentPeriods[i - 1].net

      if (current > previous) increasingCount++
      else if (current < previous) decreasingCount++
    }

    if (increasingCount > decreasingCount) return 'increasing'
    if (decreasingCount > increasingCount) return 'decreasing'
    return 'stable'
  }

  // Generate Inventory Reports
  async generateInventoryReport(inventory, inventoryUsage, filter) {
    const today = new Date()

    // Basic inventory stats
    const totalItems = inventory.length
    const totalValue = inventory.reduce((sum, item) =>
      sum + (item.quantity * (item.cost_per_unit || 0)), 0
    )

    // Low stock items
    const lowStockItems = inventory.filter(item => {
      const minStock = item.minimum_stock || 5 // Default minimum stock if not set
      return item.quantity <= minStock && item.quantity > 0
    }).length

    // Expired items
    const expiredItems = inventory.filter(item =>
      item.expiry_date && new Date(item.expiry_date) < today
    ).length

    // Expiring soon items (within 30 days)
    const expiringSoonItems = inventory.filter(item => {
      if (!item.expiry_date) return false
      const expiryDate = new Date(item.expiry_date)
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return daysUntilExpiry <= 30 && daysUntilExpiry > 0
    }).length

    // Items by category
    const categoryCounts = {}
    inventory.forEach(item => {
      const category = item.category || 'غير مصنف'
      if (!categoryCounts[category]) {
        categoryCounts[category] = { count: 0, value: 0 }
      }
      categoryCounts[category].count += 1
      categoryCounts[category].value += item.quantity * (item.cost_per_unit || 0)
    })

    const itemsByCategory = Object.entries(categoryCounts)
      .map(([category, data]) => ({ category, count: data.count, value: data.value }))
      .sort((a, b) => b.value - a.value)

    // Items by supplier
    const supplierCounts = {}
    inventory.forEach(item => {
      const supplier = item.supplier || 'غير محدد'
      if (!supplierCounts[supplier]) {
        supplierCounts[supplier] = { count: 0, value: 0 }
      }
      supplierCounts[supplier].count += 1
      supplierCounts[supplier].value += item.quantity * (item.cost_per_unit || 0)
    })

    const itemsBySupplier = Object.entries(supplierCounts)
      .map(([supplier, data]) => ({ supplier, count: data.count, value: data.value }))
      .sort((a, b) => b.value - a.value)

    // Usage trend (simplified - would need actual usage data)
    const usageTrend = [
      { period: '2024-01', usage: 150 },
      { period: '2024-02', usage: 180 },
      { period: '2024-03', usage: 165 },
      { period: '2024-04', usage: 200 },
      { period: '2024-05', usage: 175 },
      { period: '2024-06', usage: 190 }
    ]

    // Top used items (simplified)
    const topUsedItems = inventory
      .sort((a, b) => (b.quantity * (b.cost_per_unit || 0)) - (a.quantity * (a.cost_per_unit || 0)))
      .slice(0, 10)
      .map(item => ({ item: item.name, usage: item.quantity }))

    // Stock alerts - include all items that need attention
    const stockAlerts = inventory.filter(item => {
      const minStock = item.minimum_stock || 5 // Default minimum stock if not set
      const isLowStock = item.quantity <= minStock && item.quantity > 0
      const isOutOfStock = item.quantity === 0
      const isExpired = item.expiry_date && new Date(item.expiry_date) < today
      const isExpiringSoon = item.expiry_date && (() => {
        const expiryDate = new Date(item.expiry_date)
        const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        return daysUntilExpiry <= 30 && daysUntilExpiry > 0
      })()

      return isLowStock || isOutOfStock || isExpired || isExpiringSoon
    })

    // Expiry alerts
    const expiryAlerts = inventory.filter(item => {
      if (!item.expiry_date) return false
      const expiryDate = new Date(item.expiry_date)
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return daysUntilExpiry <= 30
    })

    return {
      totalItems,
      totalValue,
      lowStockItems,
      expiredItems,
      expiringSoonItems,
      itemsByCategory,
      itemsBySupplier,
      usageTrend,
      topUsedItems,
      stockAlerts,
      expiryAlerts
    }
  }

  // Generate Treatment Reports
  async generateTreatmentReport(toothTreatments, treatments, filter, patients = []) {
    console.log('🚀 Starting treatment report generation...')
    console.log('📊 Total tooth treatments received:', toothTreatments.length)
    console.log('📅 Filter:', filter)

    // Create patient lookup map for faster access
    const patientMap = {}
    if (patients && patients.length > 0) {
      patients.forEach(patient => {
        patientMap[patient.id] = patient.full_name || `${patient.first_name || ''} ${patient.last_name || ''}`.trim()
      })
    }

    const filteredTreatments = this.filterByDateRange(toothTreatments, filter.dateRange, 'created_at')
    console.log('📊 Filtered treatments:', filteredTreatments.length)

    // Basic Statistics
    const totalTreatments = filteredTreatments.length
    const completedTreatments = filteredTreatments.filter(t => t.treatment_status === 'completed').length
    const plannedTreatments = filteredTreatments.filter(t => t.treatment_status === 'planned').length
    const inProgressTreatments = filteredTreatments.filter(t => t.treatment_status === 'in_progress').length
    const cancelledTreatments = filteredTreatments.filter(t => t.treatment_status === 'cancelled').length

    // Financial Statistics
    const validateAmount = (amount) => {
      const num = Number(amount)
      return isNaN(num) || !isFinite(num) ? 0 : Math.round(num * 100) / 100
    }

    const totalRevenue = filteredTreatments
      .filter(t => t.treatment_status === 'completed')
      .reduce((sum, t) => sum + validateAmount(t.cost), 0)

    const averageTreatmentCost = totalTreatments > 0
      ? totalRevenue / (completedTreatments || 1)
      : 0

    // Revenue by Category
    const revenueByCategory = this.groupBy(
      filteredTreatments.filter(t => t.treatment_status === 'completed'),
      'treatment_category'
    ).map(group => ({
      category: group.key || 'غير محدد',
      revenue: group.items.reduce((sum, t) => sum + validateAmount(t.cost), 0),
      count: group.items.length
    }))

    // Treatment Analysis
    const treatmentsByType = this.groupBy(filteredTreatments, 'treatment_type')
      .map(group => ({
        type: this.getTreatmentNameInArabic(group.key) || 'غير محدد',
        count: group.items.length,
        percentage: totalTreatments > 0 ? Math.round((group.items.length / totalTreatments) * 100) : 0
      }))

    const treatmentsByCategory = this.groupBy(filteredTreatments, 'treatment_category')
      .map(group => ({
        category: this.getCategoryNameInArabic(group.key) || 'غير محدد',
        count: group.items.length,
        percentage: totalTreatments > 0 ? Math.round((group.items.length / totalTreatments) * 100) : 0
      }))

    const treatmentsByStatus = this.groupBy(filteredTreatments, 'treatment_status')
      .map(group => ({
        status: this.getStatusLabel(group.key || 'planned'),
        count: group.items.length,
        percentage: totalTreatments > 0 ? Math.round((group.items.length / totalTreatments) * 100) : 0
      }))

    // Performance Metrics
    const completionRate = totalTreatments > 0
      ? Math.round((completedTreatments / totalTreatments) * 100)
      : 0

    // Calculate average completion time
    const completedWithDates = filteredTreatments.filter(t =>
      t.treatment_status === 'completed' && t.start_date && t.completion_date
    )

    const averageCompletionTime = completedWithDates.length > 0
      ? completedWithDates.reduce((sum, t) => {
          const start = new Date(t.start_date)
          const end = new Date(t.completion_date)
          const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
          return sum + days
        }, 0) / completedWithDates.length
      : 0

    // Treatment Trend
    const treatmentTrend = this.groupByPeriod(filteredTreatments, 'month', 'created_at')
      .map(group => ({
        period: group.period,
        completed: group.data.filter(t => t.treatment_status === 'completed').length,
        planned: group.data.filter(t => t.treatment_status === 'planned').length
      }))

    // Most Popular Treatments
    const mostPopularTreatments = this.groupBy(filteredTreatments, 'treatment_type')
      .map(group => ({
        name: this.getTreatmentNameInArabic(group.key) || 'غير محدد',
        count: group.items.length,
        revenue: group.items
          .filter(t => t.treatment_status === 'completed')
          .reduce((sum, t) => sum + validateAmount(t.cost), 0)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Patient Analysis
    const patientTreatmentCounts = this.groupBy(filteredTreatments, 'patient_id')
    const patientsWithMultipleTreatments = patientTreatmentCounts
      .filter(group => group.items.length > 1).length

    const averageTreatmentsPerPatient = patientTreatmentCounts.length > 0
      ? totalTreatments / patientTreatmentCounts.length
      : 0

    // Time Analysis
    const treatmentsByMonth = this.groupByPeriod(filteredTreatments, 'month', 'created_at')
      .map(group => ({
        month: group.period,
        count: group.data.length
      }))

    // Peak treatment days (simplified - by day of week)
    const peakTreatmentDays = this.groupBy(
      filteredTreatments.filter(t => t.created_at),
      (t) => new Date(t.created_at).toLocaleDateString('ar', { weekday: 'long' })
    ).map(group => ({
      day: group.key || 'غير محدد',
      count: group.items.length
    })).sort((a, b) => b.count - a.count)

    // Detailed Lists with patient names
    const addPatientNames = (treatmentsList) => {
      return treatmentsList.map(treatment => ({
        ...treatment,
        patient_name: patientMap[treatment.patient_id] || `مريض ${treatment.patient_id}`
      }))
    }

    const pendingTreatments = addPatientNames(filteredTreatments.filter(t =>
      t.treatment_status === 'planned' || t.treatment_status === 'in_progress'
    ))

    // Overdue treatments (planned treatments with start_date in the past)
    const today = new Date()
    const overdueTreatments = addPatientNames(filteredTreatments.filter(t =>
      t.treatment_status === 'planned' &&
      t.start_date &&
      new Date(t.start_date) < today
    ))

    return {
      totalTreatments,
      completedTreatments,
      plannedTreatments,
      inProgressTreatments,
      cancelledTreatments,
      totalRevenue,
      averageTreatmentCost,
      revenueByCategory,
      treatmentsByType,
      treatmentsByCategory,
      treatmentsByStatus,
      completionRate,
      averageCompletionTime,
      treatmentTrend,
      mostPopularTreatments,
      patientsWithMultipleTreatments,
      averageTreatmentsPerPatient,
      treatmentsByMonth,
      peakTreatmentDays,
      treatmentsList: addPatientNames(filteredTreatments),
      pendingTreatments,
      overdueTreatments
    }
  }

  // Helper method to get status label in Arabic
  getStatusLabel(status) {
    const statusLabels = {
      'planned': 'مخطط',
      'in_progress': 'قيد التنفيذ',
      'completed': 'مكتمل',
      'cancelled': 'ملغي'
    }
    return statusLabels[status] || status
  }

  // Export treatment report to CSV
  exportTreatmentReportToCSV(reportData) {
    const csvData = []

    // Add header
    csvData.push([
      'نوع العلاج',
      'فئة العلاج',
      'حالة العلاج',
      'التكلفة',
      'تاريخ البداية',
      'تاريخ الإنجاز',
      'اسم المريض',
      'رقم السن',
      'تاريخ الإنشاء'
    ])

    // Add treatment data
    reportData.treatmentsList.forEach(treatment => {
      csvData.push([
        treatment.treatment_type || '',
        treatment.treatment_category || '',
        this.getStatusLabel(treatment.treatment_status || 'planned'),
        treatment.cost || 0,
        treatment.start_date || '',
        treatment.completion_date || '',
        treatment.patient_name || `مريض ${treatment.patient_id}`,
        treatment.tooth_number || '',
        treatment.created_at || ''
      ])
    })

    // Add summary statistics
    csvData.push([]) // Empty row
    csvData.push(['ملخص الإحصائيات'])
    csvData.push(['إجمالي العلاجات', reportData.totalTreatments])
    csvData.push(['العلاجات المكتملة', reportData.completedTreatments])
    csvData.push(['العلاجات المخططة', reportData.plannedTreatments])
    csvData.push(['العلاجات قيد التنفيذ', reportData.inProgressTreatments])
    csvData.push(['العلاجات الملغية', reportData.cancelledTreatments])
    csvData.push(['إجمالي الإيرادات', reportData.totalRevenue])
    csvData.push(['متوسط تكلفة العلاج', reportData.averageTreatmentCost])
    csvData.push(['معدل الإنجاز (%)', reportData.completionRate])

    return csvData
  }
}

module.exports = { ReportsService }
