import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { initials } from "@/lib/format"
import { cn } from "@/lib/utils"

/** Sel tabel: avatar inisial + nama + keterangan */
export function EmployeeCell({ name, subtitle, className }: { name: string; subtitle?: string; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <Avatar className="size-8">
        <AvatarFallback className="bg-muted text-foreground/70 text-[11px] font-semibold">{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        {subtitle && <p className="text-muted-foreground truncate text-xs">{subtitle}</p>}
      </div>
    </div>
  )
}
