import * as React from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export interface ComboboxOption {
  value: string
  label: string
}

export interface ComboboxProps {
  options: ComboboxOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyMessage?: string
  className?: string
  disabled?: boolean
}

export const Combobox = React.forwardRef<HTMLButtonElement, ComboboxProps>(
  (
    {
      options,
      value,
      onChange,
      placeholder = 'اختر...',
      emptyMessage = 'لا توجد نتائج.',
      className,
      disabled = false,
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false)
    const [searchValue, setSearchValue] = React.useState('')
    const containerRef = React.useRef<HTMLDivElement>(null)
    const inputRef = React.useRef<HTMLInputElement>(null)
    const listRef = React.useRef<HTMLDivElement>(null)
    const [highlightedIndex, setHighlightedIndex] = React.useState(-1)

    const selectedOption = React.useMemo(
      () => options.find((option) => option.value === value),
      [options, value]
    )

    const filteredOptions = React.useMemo(() => {
      if (!searchValue.trim()) {
        return options
      }
      const search = searchValue.toLowerCase().trim()
      return options.filter((option) =>
        option.label.toLowerCase().includes(search)
      )
    }, [options, searchValue])

    React.useEffect(() => {
      if (open && inputRef.current) {
        inputRef.current.focus()
      }
    }, [open])

    React.useEffect(() => {
      setHighlightedIndex(-1)
    }, [searchValue])

    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setOpen(false)
          setSearchValue('')
        }
      }

      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!open) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault()
          setOpen(true)
        }
        return
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setHighlightedIndex(prev => 
            prev < filteredOptions.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setHighlightedIndex(prev => 
            prev > 0 ? prev - 1 : filteredOptions.length - 1
          )
          break
        case 'Enter':
          e.preventDefault()
          if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
            const selected = filteredOptions[highlightedIndex]
            onChange(selected.value)
            setOpen(false)
            setSearchValue('')
          }
          break
        case 'Escape':
          setOpen(false)
          setSearchValue('')
          break
      }
    }

    React.useEffect(() => {
      if (highlightedIndex >= 0 && listRef.current) {
        const highlightedElement = listRef.current.children[highlightedIndex] as HTMLElement
        if (highlightedElement) {
          highlightedElement.scrollIntoView({ block: 'nearest' })
        }
      }
    }, [highlightedIndex])

    return (
      <div ref={containerRef} className="relative" dir="rtl">
        <Button
          ref={ref}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between h-10', className, open && 'ring-2 ring-ring ring-offset-2')}
          disabled={disabled}
          onClick={() => setOpen(!open)}
          onKeyDown={handleKeyDown}
          type="button"
        >
          <span className={cn('truncate', !selectedOption && 'text-muted-foreground')}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>

        {open && (
          <div
            className="absolute z-50 w-full mt-1 rounded-md border bg-popover shadow-md animate-in fade-in-0 zoom-in-95"
            dir="rtl"
          >
            <div className="flex items-center border-b px-3 py-2">
              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              <Input
                ref={inputRef}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={placeholder}
                className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-6 text-sm"
                onKeyDown={handleKeyDown}
              />
            </div>
            <div 
              ref={listRef}
              className="max-h-[300px] overflow-y-auto p-1"
            >
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </div>
              ) : (
                filteredOptions.map((option, index) => (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
                      highlightedIndex === index && 'bg-accent text-accent-foreground',
                      value === option.value && 'bg-accent/50'
                    )}
                    onClick={() => {
                      onChange(option.value)
                      setOpen(false)
                      setSearchValue('')
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <Check
                      className={cn(
                        'ml-2 h-4 w-4',
                        value === option.value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {option.label}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    )
  }
)

Combobox.displayName = 'Combobox'
