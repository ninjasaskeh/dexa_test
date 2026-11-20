import { IconSearch } from "@tabler/icons-react"
import { DateRangeFilter } from "@/components/date-range-filter"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { AttendanceFilters } from "@/hooks/queries"

interface Props {
  value: AttendanceFilters
  onChange: (patch: Partial<AttendanceFilters>) => void
  searchValue?: string
  onSearchChange?: (v: string) => void
}

/** Toolbar filter absensi: pencarian (opsional), rentang tanggal, tipe */
export function AttendanceFiltersBar({ value, onChange, searchValue, onSearchChange }: Props) {
  return (
    <div className="flex flex-col gap-2 p-4 sm:flex-row sm:flex-wrap sm:items-center">
      {onSearchChange && (
        <div className="relative sm:w-64">
          <IconSearch className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input value={searchValue} onChange={(e) => onSearchChange(e.target.value)} placeholder="Cari nama / kode / jabatan…" className="pl-8" />
        </div>
      )}
      <DateRangeFilter from={value.from} to={value.to} onChange={(r) => onChange({ ...r, page: 1 })} />
      <Select value={value.type ?? "all"} onValueChange={(v) => onChange({ type: v === "all" ? undefined : v, page: 1 })}>
        <SelectTrigger className="sm:w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua tipe</SelectItem>
          <SelectItem value="CHECK_IN">Check-in</SelectItem>
          <SelectItem value="CHECK_OUT">Check-out</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
