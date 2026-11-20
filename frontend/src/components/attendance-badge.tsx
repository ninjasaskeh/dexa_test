import { IconArrowDownRight, IconArrowUpRight, IconPencilCheck } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import type { AttendanceType, LeaveType, RequestStatus } from "@/types"

const pill = "inline-flex w-fit shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap"

/** Label tipe absen: Check-in / Check-out */
export function AttendanceTypeBadge({ type }: { type: AttendanceType }) {
  const isIn = type === "CHECK_IN"
  return (
    <span className={cn(pill, isIn ? "bg-primary/8 text-primary" : "bg-muted text-foreground/70")}>
      {isIn ? <IconArrowDownRight className="size-3.5" /> : <IconArrowUpRight className="size-3.5" />}
      {isIn ? "Check-in" : "Check-out"}
    </span>
  )
}

/** Status ketepatan waktu check-in */
export function PunctualityBadge({ late }: { late: boolean }) {
  return (
    <span className={cn(pill, late ? "bg-warning/12 text-warning-foreground" : "bg-success/10 text-success")}>
      <span className={cn("size-1.5 rounded-full", late ? "bg-warning" : "bg-success")} />
      {late ? "Terlambat" : "Tepat waktu"}
    </span>
  )
}

/** Status aktif/nonaktif karyawan */
export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm", active ? "text-foreground" : "text-muted-foreground")}>
      <span className={cn("size-1.5 rounded-full", active ? "bg-success" : "bg-muted-foreground/50")} />
      {active ? "Aktif" : "Nonaktif"}
    </span>
  )
}

/** Penanda jam absen hasil koreksi yang disetujui HRD */
export function CorrectedBadge() {
  return (
    <span className={cn(pill, "bg-muted text-foreground/70")}>
      <IconPencilCheck className="size-3.5" />
      Dikoreksi
    </span>
  )
}

export const LEAVE_LABEL: Record<LeaveType, string> = { CUTI: "Cuti", IZIN: "Izin", SAKIT: "Sakit" }

export function LeaveTypeBadge({ type }: { type: LeaveType }) {
  return <span className={cn(pill, "bg-primary/8 text-primary")}>{LEAVE_LABEL[type]}</span>
}

const STATUS: Record<RequestStatus, { label: string; className: string; dot: string }> = {
  PENDING: { label: "Menunggu", className: "bg-warning/12 text-warning-foreground", dot: "bg-warning" },
  APPROVED: { label: "Disetujui", className: "bg-success/10 text-success", dot: "bg-success" },
  REJECTED: { label: "Ditolak", className: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  CANCELLED: { label: "Dibatalkan", className: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/50" },
}

/** Status pengajuan cuti/izin/sakit & koreksi */
export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const s = STATUS[status]
  return (
    <span className={cn(pill, s.className)}>
      <span className={cn("size-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  )
}
