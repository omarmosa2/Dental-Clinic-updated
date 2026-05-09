import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Search, X } from 'lucide-react'

interface ClinicNeedsFiltersProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  filters: {
    supplier?: string
  }
  onFilterChange: (key: string, value: string) => void
  suppliers: string[]
  onClearFilters: () => void
}

const ClinicNeedsFilters: React.FC<ClinicNeedsFiltersProps> = ({
  searchQuery,
  onSearchChange,
  filters,
  onFilterChange,
  suppliers,
  onClearFilters
}) => {
  const hasActiveFilters = searchQuery || filters.supplier

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            البحث والتصفية
          </CardTitle>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              مسح الفلاتر
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="البحث في الطلبات..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pr-10"
            />
          </div>

          {/* Supplier Filter */}
          <Select
            value={filters.supplier || 'all'}
            onValueChange={(value) => onFilterChange('supplier', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="المورد" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الموردين</SelectItem>
              {suppliers.map((supplier) => (
                <SelectItem key={supplier} value={supplier}>
                  {supplier}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filter Summary */}
        {hasActiveFilters && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg">
            <div className="text-sm text-muted-foreground">
              الفلاتر النشطة:
              {searchQuery && (
                <span className="inline-block bg-primary/10 text-primary px-2 py-1 rounded mr-2 text-xs">
                  البحث: "{searchQuery}"
                </span>
              )}
              {filters.supplier && filters.supplier !== 'all' && (
                <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded mr-2 text-xs">
                  المورد: {filters.supplier}
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ClinicNeedsFilters
