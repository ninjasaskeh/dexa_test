import { cn } from "@/lib/utils"

/** Progress bar tipis (komponen custom) */
export function Progress({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  const v = Math.min(100, Math.max(0, value))
  return (
    <div className={cn("bg-muted h-1.5 w-full overflow-hidden rounded-full", className)} role="progressbar" aria-valuenow={Math.round(v)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("bg-primary h-full rounded-full transition-[width] duration-500", barClassName)} style={{ width: `${v}%` }} />
    </div>
  )
}
