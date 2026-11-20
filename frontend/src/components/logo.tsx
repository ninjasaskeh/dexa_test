import { cn } from "@/lib/utils"

/** Logo aplikasi (rumah + tanda centang = absen WFH) */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path d="M8 15.5 16 9l8 6.5V23a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-7.5Z" className="stroke-primary-foreground" strokeWidth="2" strokeLinejoin="round" />
      <path d="m12.5 17.5 2.5 2.5 4.5-4.5" className="stroke-primary-foreground" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
