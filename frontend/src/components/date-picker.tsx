import { useState, type Ref } from "react"
import { format, parseISO } from "date-fns"
import { id as localeId } from "date-fns/locale"
import { IconCalendar } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { toISODate } from "@/lib/format"
import { cn } from "@/lib/utils"

/** batas akhir dropdown tahun bila tidak ada `max` */
const LAST_SELECTABLE_MONTH = new Date(new Date().getFullYear() + 5, 11)

interface Props {
  /** "YYYY-MM-DD" atau "" */
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  id?: string
  name?: string
  placeholder?: string
  /** batas bawah/atas "YYYY-MM-DD" (inklusif) */
  min?: string
  max?: string
  disabled?: boolean
  /** dropdown bulan & tahun, untuk tanggal yang bisa jauh ke belakang (mis. tanggal bergabung) */
  withYearSelect?: boolean
  className?: string
  "aria-invalid"?: boolean
  ref?: Ref<HTMLButtonElement>
}

/**
 * Field tanggal berbasis shadcn Calendar + Popover. Nilai tetap string "YYYY-MM-DD" agar cocok
 * dengan schema Zod dan API. Dipakai lewat FormField: `{(f) => <DatePicker {...f} />}`.
 */
export function DatePicker({ value, onChange, onBlur, id, name, placeholder = "Pilih tanggal", min, max, disabled, withYearSelect, className, ref, ...rest }: Props) {
  const [open, setOpen] = useState(false)
  const selected = value ? parseISO(value) : undefined
  const minDate = min ? parseISO(min) : undefined
  const maxDate = max ? parseISO(max) : undefined
  const invalid = rest["aria-invalid"]

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) onBlur?.()
      }}
    >
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          id={id}
          name={name}
          type="button"
          variant="outline"
          disabled={disabled}
          aria-invalid={invalid}
          className={cn("w-full justify-start font-normal", !value && "text-muted-foreground", className)}
        >
          <IconCalendar />
          {selected ? format(selected, "d MMMM yyyy", { locale: localeId }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={localeId}
          selected={selected}
          defaultMonth={selected ?? maxDate ?? minDate}
          captionLayout={withYearSelect ? "dropdown" : "label"}
          startMonth={withYearSelect ? new Date(2000, 0) : undefined}
          endMonth={withYearSelect ? (maxDate ?? LAST_SELECTABLE_MONTH) : undefined}
          disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]}
          onSelect={(d) => {
            onChange(d ? toISODate(d) : "")
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
