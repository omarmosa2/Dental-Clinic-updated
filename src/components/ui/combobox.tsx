import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

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
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setOpen(false)
        }
      }

      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
      <div ref={containerRef} className="relative" dir="rtl">
        <Button
          ref={ref}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('w-full justify-between', className, open && 'ring-2 ring-ring ring-offset-2')}
          disabled={disabled}
          onClick={() => {
            setOpen(!open)
            if (!open) {
              setTimeout(() => {
                const input = containerRef.current?.querySelector('input')
                input?.focus()
              }, 0)
            }
          }}
          type="button"
        >
          <span className={cn('truncate', !selectedOption && 'text-muted-foreground')}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronsUpDown className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>

        {open && (
          <div className="absolute z-50 w-full mt-1 rounded-md border bg-popover p-0 shadow-md animate-in fade-in-0 zoom-in-95">
            <Command shouldFilter={false} loop className="border-0">
              <CommandInput
                value={searchValue}
                onValueChange={setSearchValue}
                placeholder={placeholder}
                className="border-b"
              />
              <CommandList className="max-h-[300px]">
                <CommandEmpty>{emptyMessage}</CommandEmpty>
                <CommandGroup>
                  {filteredOptions.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={(currentValue) => {
                        onChange(currentValue === value ? '' : currentValue)
                        setOpen(false)
                        setSearchValue('')
                      }}
                    >
                      <Check
                        className={cn(
                          'ml-2 h-4 w-4',
                          value === option.value ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        )}
      </div>
    )
  }
)

Combobox.displayName = 'Combobox'
