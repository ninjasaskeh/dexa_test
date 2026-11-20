import { useEffect, useState, type ReactNode } from "react"
import { IconPhotoOff, IconPencilCheck } from "@tabler/icons-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { usePhotoBlob } from "@/hooks/queries"
import { fmtDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Attendance } from "@/types"
import { AttendanceTypeBadge, PunctualityBadge } from "./attendance-badge"

/** Object URL dari blob foto; dicabut lagi saat blob berganti / komponen dilepas */
function useObjectUrl(blob?: Blob) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => {
      URL.revokeObjectURL(u)
      setUrl(undefined)
    }
  }, [blob])
  return url
}

/** Thumbnail foto absen yang bisa diklik untuk melihat ukuran penuh. Foto diambil dengan token (tidak publik). */
export function PhotoThumb({ attendance, title, size = "sm" }: { attendance: Attendance; title?: ReactNode; size?: "sm" | "lg" }) {
  const hasPhoto = !!attendance.photoPath
  const photo = usePhotoBlob(attendance.id, hasPhoto)
  const url = useObjectUrl(photo.data)
  const box = cn("relative shrink-0 overflow-hidden rounded-md border bg-muted", size === "lg" ? "size-16" : "size-9")

  if (!hasPhoto) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(box, "text-muted-foreground flex items-center justify-center")} aria-label="Absen hasil koreksi, tanpa foto">
            <IconPencilCheck className="size-4" />
          </span>
        </TooltipTrigger>
        <TooltipContent>Absen hasil koreksi HRD, tanpa foto</TooltipContent>
      </Tooltip>
    )
  }

  const image = (className: string, alt: string) =>
    url ? (
      <img src={url} alt={alt} className={className} />
    ) : photo.isError ? (
      <span className="text-muted-foreground flex size-full items-center justify-center"><IconPhotoOff className="size-4" /></span>
    ) : (
      <Skeleton className="size-full rounded-none" />
    )

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={cn(box, "group focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none")} aria-label="Lihat foto bukti">
          {image("size-full object-cover transition duration-300 group-hover:scale-105", "")}
        </button>
      </DialogTrigger>
      <DialogContent className="gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title ?? "Foto bukti WFH"}</DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <span className="tabular-nums">{fmtDateTime(attendance.recordedAt)}</span>
            <AttendanceTypeBadge type={attendance.type} />
            {attendance.type === "CHECK_IN" && <PunctualityBadge late={attendance.isLate} />}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-lg bg-muted">
          {image("max-h-[70vh] w-full object-contain", "Foto bukti WFH")}
        </div>
        {attendance.correctionId && <p className="text-muted-foreground text-sm">Jam absen ini sudah dikoreksi dan disetujui HRD.</p>}
        {attendance.notes && <p className="text-sm"><span className="text-muted-foreground">Catatan:</span> {attendance.notes}</p>}
      </DialogContent>
    </Dialog>
  )
}
