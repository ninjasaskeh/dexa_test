import { format } from "date-fns"
import { id } from "date-fns/locale"
import { useServerClock } from "@/hooks/use-server-clock"
import { cn } from "@/lib/utils"

/** Jam digital real-time yang mengikuti jam server (lihat useServerClock) */
export function LiveClock({ offset, className }: { offset?: number; className?: string }) {
  const now = useServerClock(offset)
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl">
        {format(now, "HH:mm")}
        <span className="text-muted-foreground/70 ml-0.5 text-2xl font-medium sm:text-3xl">{format(now, "ss")}</span>
      </span>
      <span className="text-muted-foreground text-sm">{format(now, "EEEE, d MMMM yyyy", { locale: id })}</span>
    </div>
  )
}
