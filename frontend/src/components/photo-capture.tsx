import { useCallback, useEffect, useRef, useState } from "react"
import { IconCamera, IconCameraOff, IconPhotoUp, IconRefresh, IconX } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

interface PhotoCaptureProps {
  value: File | null
  onChange: (file: File | null) => void
  invalid?: boolean
  disabled?: boolean
}

/**
 * Komponen custom: ambil foto bukti WFH lewat kamera (getUserMedia)
 * atau unggah file dari perangkat. Hasilnya berupa File JPEG/PNG/WEBP.
 */
export function PhotoCapture({ value, onChange, invalid, disabled }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [mode, setMode] = useState<"idle" | "starting" | "camera">("idle")
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!value) return setPreview(null)
    const url = URL.createObjectURL(value)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [value])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setMode("idle")
  }, [])

  useEffect(() => stopCamera, [stopCamera])

  const startCamera = async () => {
    setCameraError(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Browser tidak mendukung kamera. Silakan unggah foto.")
      return
    }
    setMode("starting")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      streamRef.current = stream
      setMode("camera")
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          void videoRef.current.play()
        }
      })
    } catch {
      setMode("idle")
      setCameraError("Akses kamera ditolak atau tidak tersedia. Silakan unggah foto.")
    }
  }

  const capture = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement("canvas")
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")!
    ctx.translate(canvas.width, 0) // mirror agar sesuai pratinjau selfie
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      onChange(new File([blob], `wfh-${Date.now()}.jpg`, { type: "image/jpeg" }))
      stopCamera()
    }, "image/jpeg", 0.85)
  }

  return (
    <div
      className={cn(
        "relative flex min-h-64 w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-muted/40 transition-colors sm:min-h-0 sm:aspect-video",
        invalid && "border-destructive/60 bg-destructive/5",
        (preview || mode !== "idle") && "aspect-[3/4] min-h-0 border-solid border-transparent bg-black sm:aspect-video",
      )}
    >
      {preview ? (
        <>
          <img src={preview} alt="Pratinjau foto bukti WFH" className="size-full object-cover" />
          {!disabled && (
            <div className="absolute right-3 bottom-3 flex gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => { onChange(null); void startCamera() }}>
                <IconRefresh /> Ambil ulang
              </Button>
              <Button type="button" size="icon-sm" variant="secondary" aria-label="Hapus foto" onClick={() => onChange(null)}>
                <IconX />
              </Button>
            </div>
          )}
        </>
      ) : mode === "camera" || mode === "starting" ? (
        <>
          <video ref={videoRef} playsInline muted className="size-full -scale-x-100 object-cover" />
          {mode === "starting" && <Spinner className="absolute size-8 text-white" />}
          <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-3">
            <Button type="button" variant="secondary" size="icon" aria-label="Tutup kamera" onClick={stopCamera}>
              <IconCameraOff />
            </Button>
            <button
              type="button"
              onClick={capture}
              disabled={mode !== "camera"}
              aria-label="Ambil foto"
              className="size-16 rounded-full border-4 border-white bg-white/30 backdrop-blur transition hover:bg-white/50 active:scale-95 disabled:opacity-50"
            />
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <IconCamera className="size-6" />
          </div>
          <div>
            <p className="font-medium">Foto bukti bekerja dari rumah</p>
            <p className="text-muted-foreground text-sm">Ambil selfie di tempat kerja Anda, atau unggah foto (maks. 5 MB)</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button type="button" onClick={startCamera} disabled={disabled}>
              <IconCamera /> Buka kamera
            </Button>
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={disabled}>
              <IconPhotoUp /> Unggah foto
            </Button>
          </div>
          {cameraError && <p className="text-destructive text-sm">{cameraError}</p>}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onChange(f)
          e.target.value = ""
        }}
      />
    </div>
  )
}
