import React, { useState, useMemo } from 'react'
import { Payment, Patient } from '@/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getTreatmentNameInArabic } from '@/utils/arabicTranslations'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Edit,
  Trash2,
  Printer,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Layers
} from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/utils'

type SortField = 'payment_date' | 'amount' | 'patient_name' | 'payment_method' | 'status' | 'receipt_number'
type SortDirection = 'asc' | 'desc'

interface PaymentTableProps {
  payments: Payment[]
  patients: Patient[]
  isLoading: boolean
  onEdit: (payment: Payment) => void
  onDelete: (payment: Payment) => void
  onShowReceipt: (payment: Payment) => void
  onViewDetails: (payment: Payment) => void
}

interface ComprehensiveGroup {
  batchId: string
  payments: Payment[]
  totalAmount: number
  patientName: string
  patientId: string
  paymentDate: string
  paymentMethod: string
  overallStatus: 'completed' | 'partial'
  receiptNumber: string
}

export default function PaymentTable({
  payments,
  patients,
  isLoading,
  onEdit,
  onDelete,
  onShowReceipt,
  onViewDetails
}: PaymentTableProps) {
  const [sortField, setSortField] = useState<SortField>('payment_date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set())

  const getPatientName = (payment: Payment) => {
    if (payment.patient?.full_name) {
      return payment.patient.full_name
    }
    return payment.patient?.full_name || 'مريض غير محدد'
  }

  const { groupedPayments, comprehensiveGroups } = useMemo(() => {
    const groups: Map<string, ComprehensiveGroup> = new Map()
    const regularPayments: Payment[] = []

    payments.forEach(payment => {
      if (payment.is_comprehensive && payment.comprehensive_batch_id) {
        const batchId = payment.comprehensive_batch_id
        if (!groups.has(batchId)) {
          groups.set(batchId, {
            batchId,
            payments: [],
            totalAmount: 0,
            patientName: getPatientName(payment),
            patientId: payment.patient_id,
            paymentDate: payment.payment_date,
            paymentMethod: payment.payment_method,
            overallStatus: 'completed',
            receiptNumber: payment.receipt_number || ''
          })
        }
        const group = groups.get(batchId)!
        group.payments.push(payment)
        group.totalAmount += payment.total_amount || payment.amount
        if (payment.status === 'partial') {
          group.overallStatus = 'partial'
        }
      } else {
        regularPayments.push(payment)
      }
    })

    return {
      comprehensiveGroups: Array.from(groups.values()),
      groupedPayments: regularPayments
    }
  }, [payments])

  const toggleBatch = (batchId: string) => {
    setExpandedBatches(prev => {
      const next = new Set(prev)
      if (next.has(batchId)) {
        next.delete(batchId)
      } else {
        next.add(batchId)
      }
      return next
    })
  }

  const allItems = useMemo(() => {
    const items: Array<{ type: 'regular'; payment: Payment } | { type: 'group-header'; group: ComprehensiveGroup } | { type: 'group-child'; payment: Payment; batchId: string }> = []

    groupedPayments.forEach(payment => {
      items.push({ type: 'regular', payment })
    })

    comprehensiveGroups.forEach(group => {
      items.push({ type: 'group-header', group })
      if (expandedBatches.has(group.batchId)) {
        group.payments.forEach(payment => {
          items.push({ type: 'group-child', payment, batchId: group.batchId })
        })
      }
    })

    items.sort((a, b) => {
      const dateA = a.type === 'group-header' ? a.group.paymentDate : a.payment.payment_date
      const dateB = b.type === 'group-header' ? b.group.paymentDate : b.payment.payment_date
      const timeA = new Date(dateA).getTime()
      const timeB = new Date(dateB).getTime()
      return sortDirection === 'desc' ? timeB - timeA : timeA - timeB
    })

    return items
  }, [groupedPayments, comprehensiveGroups, expandedBatches, sortDirection])

  const totalPages = Math.ceil(allItems.length / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const paginatedItems = allItems.slice(startIndex, startIndex + pageSize)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 text-center"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center justify-center space-x-1 space-x-reverse">
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
        ) : (
          <ArrowUpDown className="w-4 h-4 opacity-50" />
        )}
      </div>
    </TableHead>
  )

  const getPaymentMethodLabel = (method: string) => {
    const methods = {
      cash: 'نقداً',
      bank_transfer: 'تحويل بنكي'
    }
    return methods[method as keyof typeof methods] || method
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      completed: { label: 'مكتمل', variant: 'default' as const },
      partial: { label: 'جزئي', variant: 'outline' as const },
      pending: { label: 'معلق', variant: 'secondary' as const }
    }

    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, variant: 'outline' as const }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  if (isLoading) {
    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>رقم الإيصال</TableHead>
              <TableHead>المريض</TableHead>
              <TableHead>المبلغ</TableHead>
              <TableHead>طريقة الدفع</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>تاريخ الدفع</TableHead>
              <TableHead>الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, index) => (
              <TableRow key={index}>
                {[...Array(7)].map((_, cellIndex) => (
                  <TableCell key={cellIndex}>
                    <div className="h-4 bg-muted animate-pulse rounded" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (allItems.length === 0) {
    return (
      <div className="border rounded-lg">
        <Table className="table-center-all">
          <TableHeader>
            <TableRow>
              <TableHead className="text-center">#</TableHead>
              <SortableHeader field="patient_name">المريض</SortableHeader>
              <TableHead className="text-center">العلاج/الموعد</TableHead>
              <SortableHeader field="amount">المبلغ والرصيد</SortableHeader>
              <SortableHeader field="payment_method">طريقة الدفع</SortableHeader>
              <SortableHeader field="status">الحالة</SortableHeader>
              <SortableHeader field="payment_date">تاريخ الدفع</SortableHeader>
              <TableHead className="text-center">
                <span className="arabic-enhanced font-medium">الإجراءات</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8">
                <div className="flex flex-col items-center space-y-2">
                  <DollarSign className="w-12 h-12 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">
                    لم يتم تسجيل أي مدفوعات بعد
                  </p>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    )
  }

  let displayIndex = startIndex

  return (
    <div className="space-y-4" dir="rtl">
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table className="table-center-all">
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-center">
                  <span className="arabic-enhanced font-medium">#</span>
                </TableHead>
                <SortableHeader field="patient_name">
                  <span className="arabic-enhanced font-medium">المريض</span>
                </SortableHeader>
                <TableHead className="text-center">
                  <span className="arabic-enhanced font-medium">العلاج/الموعد</span>
                </TableHead>
                <SortableHeader field="amount">
                  <span className="arabic-enhanced font-medium">المبلغ والرصيد</span>
                </SortableHeader>
                <SortableHeader field="payment_method">
                  <span className="arabic-enhanced font-medium">طريقة الدفع</span>
                </SortableHeader>
                <SortableHeader field="status">
                  <span className="arabic-enhanced font-medium">الحالة</span>
                </SortableHeader>
                <SortableHeader field="payment_date">
                  <span className="arabic-enhanced font-medium">تاريخ الدفع</span>
                </SortableHeader>
                <TableHead className="text-center">
                  <span className="arabic-enhanced font-medium">الإجراءات</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedItems.map((item) => {
                if (item.type === 'group-header') {
                  const group = item.group
                  const isExpanded = expandedBatches.has(group.batchId)
                  displayIndex++
                  return (
                    <TableRow
                      key={`group-${group.batchId}`}
                      className=" dark:hover:bg-blue-950/30 dark:bg-blue-950/20 cursor-pointer"
                      onClick={() => toggleBatch(group.batchId)}
                    >
                      <TableCell className="font-medium text-center">
                        {displayIndex}
                      </TableCell>
                      <TableCell className="font-medium text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                            <Layers className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="arabic-enhanced font-semibold text-purple-700 dark:text-purple-300">{group.patientName}</span>
                            <div className="text-xs text-muted-foreground arabic-enhanced">دفعة شاملة</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="text-sm font-medium arabic-enhanced text-purple-600 dark:text-purple-400">
                          {group.payments.length} علاج
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="font-medium text-lg text-green-600 dark:text-green-400">
                          {formatCurrency(group.totalAmount)}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="arabic-enhanced">
                          {getPaymentMethodLabel(group.paymentMethod)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={group.overallStatus === 'completed' ? 'default' : 'outline'} className="arabic-enhanced">
                          {group.overallStatus === 'completed' ? 'مكتمل' : 'جزئي'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="text-sm arabic-enhanced">
                          {formatDate(group.paymentDate)}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation()
                              group.payments.forEach(payment => onDelete(payment))
                            }}
                            title="حذف الدفعة الشاملة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-purple-600"
                          >
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                }

                if (item.type === 'group-child') {
                  const payment = item.payment
                  return (
                    <TableRow
                      key={`child-${payment.id}`}
                      className="bg-muted/30 hover:bg-muted/50 dark:bg-card/30 dark:hover:bg-card/50"
                    >
                      <TableCell className="text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-1">
                          <div className="w-2 h-2 bg-purple-400 rounded-full" />
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground arabic-enhanced">
                        {getPatientName(payment)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="space-y-1">
                          <div className="text-sm font-medium arabic-enhanced text-blue-600 dark:text-blue-400">
                            السن {payment.tooth_treatment?.tooth_number}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {getTreatmentNameInArabic(payment.tooth_treatment?.treatment_type || '')}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="font-medium text-green-600 dark:text-green-400">
                          {formatCurrency(payment.total_amount || payment.amount)}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="arabic-enhanced">
                          {getPaymentMethodLabel(payment.payment_method)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {getStatusBadge(payment.status)}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="text-sm arabic-enhanced">
                          {formatDate(payment.payment_date)}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center space-x-1 space-x-reverse">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="action-btn-details text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                            onClick={(e) => { e.stopPropagation(); onViewDetails(payment) }}
                            title="عرض التفاصيل"
                          >
                            <Eye className="w-4 h-4 ml-1" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="action-btn-receipt dark:text-foreground dark:hover:bg-muted"
                            onClick={(e) => { e.stopPropagation(); onShowReceipt(payment) }}
                          >
                            <Printer className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                }

                const payment = item.payment
                displayIndex++
                return (
                  <TableRow key={payment.id} className="hover:bg-muted/50 dark:bg-card/40 dark:hover:bg-card/60">
                    <TableCell className="font-medium text-center">
                      {displayIndex}
                    </TableCell>
                    <TableCell className="font-medium text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground text-sm font-medium">
                          {getPatientName(payment).charAt(0)}
                        </div>
                        <span className="arabic-enhanced">{getPatientName(payment)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {payment.tooth_treatment_id ? (
                        <div className="space-y-1">
                          <div className="text-sm font-medium arabic-enhanced text-blue-600 dark:text-blue-400">
                            السن {payment.tooth_treatment?.tooth_number}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {getTreatmentNameInArabic(payment.tooth_treatment?.treatment_type || '')}
                          </div>
                          {payment.treatment_total_cost && (
                            <div className="text-xs text-muted-foreground">
                              تكلفة: {formatCurrency(payment.treatment_total_cost)}
                            </div>
                          )}
                          {payment.treatment_remaining_balance !== undefined && payment.treatment_remaining_balance > 0 && (
                            <div className="text-xs text-orange-600 dark:text-orange-400">
                              متبقي: {formatCurrency(payment.treatment_remaining_balance)}
                            </div>
                          )}
                        </div>
                      ) : payment.appointment_id ? (
                        <div className="space-y-1">
                          {(() => {
                            const appointmentDate = payment.appointment?.start_time
                            if (appointmentDate) {
                              try {
                                const date = new Date(appointmentDate)
                                if (!isNaN(date.getTime())) {
                                  return (
                                    <>
                                      <div className="text-sm font-medium arabic-enhanced">
                                        {date.toLocaleDateString('en-GB', {
                                          year: 'numeric',
                                          month: '2-digit',
                                          day: '2-digit'
                                        })}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        {date.toLocaleTimeString('ar-SA', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                          hour12: true
                                        })}
                                      </div>
                                    </>
                                  )
                                }
                              } catch (error) {
                                console.error('Error parsing appointment date:', error)
                              }
                            }
                            return (
                              <div className="text-sm font-medium arabic-enhanced">
                                موعد محدد
                              </div>
                            )
                          })()}
                          {payment.total_amount_due && (
                            <div className="text-xs text-muted-foreground">
                              تكلفة: {formatCurrency(payment.total_amount_due)}
                            </div>
                          )}
                          {payment.remaining_balance !== undefined && payment.remaining_balance > 0 && (
                            <div className="text-xs text-orange-600 dark:text-orange-400">
                              متبقي: {formatCurrency(payment.remaining_balance)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground arabic-enhanced">
                          دفعة عامة
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground arabic-enhanced">
                            إجمالي المبلغ المدفوع:
                          </div>
                          <div className="font-medium text-lg text-green-600 dark:text-green-400">
                            {formatCurrency(payment.total_amount || payment.amount)}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-xs text-muted-foreground arabic-enhanced">
                            مبلغ الخصم:
                          </div>
                          <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded">
                            {payment.discount_amount && payment.discount_amount > 0
                              ? formatCurrency(payment.discount_amount)
                              : 'لا يوجد خصم'
                            }
                          </div>
                        </div>
                        {(() => {
                          let remainingBalance = 0
                          if (payment.tooth_treatment_id) {
                            remainingBalance = payment.treatment_remaining_balance || 0
                          } else if (payment.appointment_id) {
                            remainingBalance = payment.remaining_balance || 0
                          } else {
                            const totalDue = payment.total_amount_due || 0
                            const totalPaid = payment.amount || 0
                            remainingBalance = Math.max(0, totalDue - totalPaid)
                          }
                          if (remainingBalance > 0) {
                            return (
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground arabic-enhanced">
                                  المبلغ المتبقي:
                                </div>
                                <div className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded">
                                  {formatCurrency(remainingBalance)}
                                </div>
                              </div>
                            )
                          }
                          return null
                        })()}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="arabic-enhanced">
                        {getPaymentMethodLabel(payment.payment_method)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(payment.status)}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="text-sm arabic-enhanced">
                        {formatDate(payment.payment_date)}
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[220px] text-center">
                      <div className="flex items-center justify-center space-x-1 space-x-reverse">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="action-btn-details text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                          onClick={() => onViewDetails(payment)}
                          title="عرض التفاصيل"
                        >
                          <Eye className="w-4 h-4 ml-1" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="action-btn-receipt dark:text-foreground dark:hover:bg-muted"
                          onClick={() => onShowReceipt(payment)}
                        >
                          <Printer className="w-4 h-4 ml-1" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="action-btn-edit dark:text-foreground dark:hover:bg-muted"
                          onClick={() => onEdit(payment)}
                        >
                          <Edit className="w-4 h-4 ml-1" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="action-btn-delete dark:text-destructive dark:hover:bg-destructive/10"
                          onClick={() => onDelete(payment)}
                        >
                          <Trash2 className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {allItems.length > 0 && (
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center space-x-2 space-x-reverse">
            <p className="text-sm text-muted-foreground arabic-enhanced">
              عرض {startIndex + 1} إلى {Math.min(startIndex + pageSize, allItems.length)} من {allItems.length} مدفوعة
            </p>
          </div>

          <div className="flex items-center space-x-6 space-x-reverse lg:space-x-8">
            <div className="flex items-center space-x-2 space-x-reverse">
              <p className="text-sm font-medium arabic-enhanced">عدد الصفوف لكل صفحة</p>
              <Select
                value={`${pageSize}`}
                onValueChange={(value) => {
                  setPageSize(Number(value))
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[5, 10, 20, 30, 50].map((size) => (
                    <SelectItem key={size} value={`${size}`}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex w-[100px] items-center justify-center text-sm font-medium arabic-enhanced">
              صفحة {currentPage} من {totalPages}
            </div>

            <div className="flex items-center space-x-2 space-x-reverse">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                <span className="sr-only">الذهاب إلى الصفحة الأولى</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <span className="sr-only">الذهاب إلى الصفحة السابقة</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <span className="sr-only">الذهاب إلى الصفحة التالية</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
              >
                <span className="sr-only">الذهاب إلى الصفحة الأخيرة</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
