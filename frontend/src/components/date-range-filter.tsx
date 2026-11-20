import { useState } from "react"
import type { DateRange } from "react-day-picker"
import { IconCalendar, IconX } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { fmtDate, toISODate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { id } from "date-fns/locale"
import { parseISO, startOfMonth, subDays } from "date-fns"

interface Props {
  from?: string
  to?: string
  onChange: (range: { from?: string; to?: string }) => void
  className?: string
}

const presets = [
  { label: "Hari ini", range: () => ({ from: new Date(), to: new Date() }) },
  { label: "7 hari", range: () => ({ from: subDays(new Date(), 6), to: new Date() }) },
  { label: "30 hari", range: () => ({ from: subDays(new Date(), 29), to: new Date() }) },
  { label: "Bulan ini", range: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
]

/** Filter rentang tanggal dengan preset cepat */
export function DateRangeFilter({ from, to, onChange, className }: Props) {
  const [open, setOpen] = useState(false)
  const selected: DateRange | undefined = from ? { from: parseISO(from), to: to ? parseISO(to) : undefined } : undefined
  const apply = (r?: DateRange) =>
    onChange({ from: r?.from ? toISODate(r.from) : undefined, to: r?.to ? toISODate(r.to) : r?.from ? toISODate(r.from) : undefined })

  const label = from ? (to && to !== from ? `${fmtDate(from)} – ${fmtDate(to)}` : fmtDate(from)) : "Semua tanggal"

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn("justify-start font-normal", !from && "text-muted-foreground")}>
            <IconCalendar />
            {label}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col sm:flex-row">
            <div className="flex flex-row flex-wrap gap-1 border-b p-2 sm:flex-col sm:border-r sm:border-b-0">
              {presets.map((p) => (
                <Button key={p.label} variant="ghost" size="sm" className="justify-start" onClick={() => { apply(p.range()); setOpen(false) }}>
                  {p.label}
                </Button>
              ))}
            </div>
            <Calendar mode="range" locale={id} numberOfMonths={1} selected={selected} onSelect={apply} disabled={{ after: new Date() }} />
          </div>
        </PopoverContent>
      </Popover>
      {from && (
        <Button variant="ghost" size="icon" aria-label="Hapus filter tanggal" onClick={() => onChange({})}>
          <IconX />
        </Button>
      )}
    </div>
  )
}
