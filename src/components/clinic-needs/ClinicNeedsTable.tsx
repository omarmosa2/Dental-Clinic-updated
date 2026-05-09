import React, { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table'
import { Button } from '../ui/button'
import { Badge } from '../ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import {
  Edit,
  Trash2,
  Clock,
  CheckCircle,
  Package,
  XCircle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react'
import { formatCurrency } from '../../lib/utils'
import {
  getClinicNeedPaid,
  getClinicNeedPaymentStatus,
  getClinicNeedRemaining,
  getClinicNeedTotal,
  getPaymentStatusLabel
} from '../../utils/clinicNeedPayments'
import type { ClinicNeed } from '../../types'

interface ClinicNeedsTableProps {
  needs: ClinicNeed[]
  onEdit: (need: ClinicNeed) => void
  onDelete: (need: ClinicNeed) => void
  isLoading?: boolean
}

const ClinicNeedsTable: React.FC<ClinicNeedsTableProps> = ({
  needs,
  onEdit,
  onDelete,
  isLoading = false
}) => {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Pagination
  const totalCount = needs.length
  const totalPages = Math.ceil(totalCount / pageSize)
  const startIndex = (currentPage - 1) * pageSize
  const paginatedNeeds = needs.slice(startIndex, startIndex + pageSize)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (value: string) => {
    setPageSize(parseInt(value))
    setCurrentPage(1) // Reset to first page when changing page size
  }
  const getPaymentStatusBadge = (need: ClinicNeed) => {
    const status = getClinicNeedPaymentStatus(need)
    const statusConfig = {
      paid: { variant: 'default' as const, icon: CheckCircle, className: 'bg-green-100 text-green-800 hover:bg-green-100' },
      partial: { variant: 'default' as const, icon: Clock, className: 'bg-amber-100 text-amber-800 hover:bg-amber-100' },
      unpaid: { variant: 'destructive' as const, icon: XCircle, className: '' }
    }

    const config = statusConfig[status]
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className={`flex items-center gap-1 w-fit ${config.className}`}>
        <Icon className="w-3 h-3" />
        {getPaymentStatusLabel(status)}
      </Badge>
    )
  }

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-muted-foreground">جاري التحميل...</p>
      </div>
    )
  }

  if (needs.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-muted-foreground mb-2">
          لا توجد احتياجات
        </h3>
        <p className="text-muted-foreground">
          لم يتم العثور على أي احتياجات مطابقة للبحث
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border" dir="rtl">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-center">#</TableHead>
            <TableHead className="text-right">اسم الاحتياج</TableHead>
            <TableHead className="text-right">الكمية</TableHead>
            <TableHead className="text-right">السعر</TableHead>
            <TableHead className="text-right">الإجمالي</TableHead>
            <TableHead className="text-right">المدفوع</TableHead>
            <TableHead className="text-right">المتبقي</TableHead>
            <TableHead className="text-right">حالة الدفع</TableHead>
            <TableHead className="text-right">المستودع</TableHead>
            <TableHead className="text-right">الإجراءات</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedNeeds.map((need, index) => {
            const total = getClinicNeedTotal(need)
            const paid = getClinicNeedPaid(need)
            const remaining = getClinicNeedRemaining(need)

            return (
              <TableRow key={need.id} className="hover:bg-muted/50">
              <TableCell className="font-medium text-center">
                <span className="text-sm text-muted-foreground">
                  {startIndex + index + 1}
                </span>
              </TableCell>

              <TableCell>
                <div>
                  <div className="font-medium">{need.need_name}</div>
                  {need.description && (
                    <div className="text-sm text-muted-foreground mt-1 max-w-xs truncate">
                      {need.description}
                    </div>
                  )}
                </div>
              </TableCell>

              <TableCell>
                <span className="font-medium">{need.quantity}</span>
              </TableCell>

              <TableCell>
                <span className="font-medium">{formatCurrency(need.price)}</span>
              </TableCell>

              <TableCell>
                <span className="font-bold text-primary">
                  {formatCurrency(total)}
                </span>
              </TableCell>

              {/* <TableCell>
                {need.category && (
                  <Badge variant="outline" className="w-fit">
                    {need.category}
                  </Badge>
                )}
              </TableCell> */}

              <TableCell>
                <span className="font-semibold text-green-600">{formatCurrency(paid)}</span>
              </TableCell>

              <TableCell>
                <span className={`font-semibold ${remaining > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                  {formatCurrency(remaining)}
                </span>
              </TableCell>

              <TableCell>
                {getPaymentStatusBadge(need)}
              </TableCell>

              <TableCell>
                {need.supplier && (
                  <span className="text-sm">{need.supplier}</span>
                )}
              </TableCell>

              <TableCell>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(need)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(need)}
                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-4">
          <div className="flex items-center space-x-6 space-x-reverse lg:space-x-8">
            <div className="flex items-center space-x-2 space-x-reverse">
              <p className="text-sm font-medium arabic-enhanced">عدد الصفوف لكل صفحة</p>
              <Select
                value={`${pageSize}`}
                onValueChange={handlePageSizeChange}
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
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
              >
                <span className="sr-only">الذهاب إلى الصفحة الأولى</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <span className="sr-only">الذهاب إلى الصفحة السابقة</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <span className="sr-only">الذهاب إلى الصفحة التالية</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
              >
                <span className="sr-only">الذهاب إلى الصفحة الأخيرة</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center space-x-2 space-x-reverse text-sm text-muted-foreground arabic-enhanced">
            عرض {startIndex + 1} إلى {Math.min(startIndex + pageSize, totalCount)} من {totalCount} نتيجة
          </div>
        </div>
      )}
    </div>
  )
}

export default ClinicNeedsTable
