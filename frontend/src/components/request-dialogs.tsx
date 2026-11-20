import { useEffect } from "react"
import { useForm, type FieldValues, type Path, type UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { addDays, format, parseISO } from "date-fns"
import { DatePicker } from "@/components/date-picker"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { useCreateRequest, useReviewRequest, type RequestKind } from "@/hooks/queries"
import { getErrorMessage, getFieldErrors } from "@/lib/api"
import {
  correctionSchema, leaveSchema, reviewSchema, type CorrectionValues, type LeaveValues, type ReviewValues,
} from "@/lib/schemas"

/** Sama dengan batas di backend (leave-service & attendance-service) */
const LEAVE_BACKDATE_DAYS = 7
const CORRECTION_MAX_DAYS = 30

const shift = (date: string, days: number) => format(addDays(parseISO(date), days), "yyyy-MM-dd")

/** Error per field dari backend ditempel ke form, pesan umum ke toast */
function showError<T extends FieldValues>(form: UseFormReturn<T>, e: unknown, title: string) {
  Object.entries(getFieldErrors(e)).forEach(([k, m]) => form.setError(k as Path<T>, { message: m }))
  toast.error(title, { description: getErrorMessage(e) })
}

interface FormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** tanggal hari ini menurut server */
  today: string
}

/** Karyawan mengajukan cuti / izin / sakit */
export function LeaveFormDialog({ open, onOpenChange, today }: FormDialogProps) {
  const create = useCreateRequest("leave")
  const form = useForm<LeaveValues>({ resolver: zodResolver(leaveSchema), defaultValues: { type: "CUTI", startDate: today, endDate: today, reason: "" } })
  useEffect(() => {
    if (open) form.reset({ type: "CUTI", startDate: today, endDate: today, reason: "" })
  }, [open, today, form])
  const type = form.watch("type")
  const start = form.watch("startDate")

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await create.mutateAsync(v)
      toast.success("Pengajuan terkirim", { description: "Menunggu persetujuan Admin HRD." })
      onOpenChange(false)
    } catch (e) {
      showError(form, e, "Pengajuan gagal")
    }
  })

  const c = form.control
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajukan cuti / izin / sakit</DialogTitle>
          <DialogDescription>
            Cuti diajukan sebelum tanggal mulai. Izin dan sakit dapat diajukan paling lambat {LEAVE_BACKDATE_DAYS} hari setelahnya.
          </DialogDescription>
        </DialogHeader>
        <form id="leave-form" onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-5">
            <FormField control={c} name="type" label="Jenis">
              {({ value, onChange, id }) => (
                <Select value={value} onValueChange={onChange}>
                  <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CUTI">Cuti</SelectItem>
                    <SelectItem value="IZIN">Izin</SelectItem>
                    <SelectItem value="SAKIT">Sakit</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </FormField>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField control={c} name="startDate" label="Mulai">
                {(f) => <DatePicker {...f} min={type === "CUTI" ? today : shift(today, -LEAVE_BACKDATE_DAYS)} />}
              </FormField>
              <FormField control={c} name="endDate" label="Selesai">
                {(f) => <DatePicker {...f} min={start || undefined} />}
              </FormField>
            </div>
            <FormField control={c} name="reason" label="Alasan">
              {(f) => <Textarea {...f} rows={3} maxLength={255} placeholder={type === "SAKIT" ? "Demam, istirahat sesuai anjuran dokter" : "Acara keluarga di luar kota"} />}
            </FormField>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button type="submit" form="leave-form" disabled={create.isPending}>{create.isPending && <Spinner />} Kirim pengajuan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Karyawan mengajukan koreksi jam absen (lupa check-in / check-out) */
export function CorrectionFormDialog({ open, onOpenChange, today, initial }: FormDialogProps & { initial?: Partial<CorrectionValues> }) {
  const create = useCreateRequest("corrections")
  const empty: CorrectionValues = { date: today, type: "CHECK_OUT", time: "", reason: "" }
  const form = useForm<CorrectionValues>({ resolver: zodResolver(correctionSchema), defaultValues: empty })
  useEffect(() => {
    if (open) form.reset({ date: today, type: "CHECK_OUT", time: "", reason: "", ...initial })
  }, [open, today, initial, form])

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await create.mutateAsync(v)
      toast.success("Pengajuan koreksi terkirim", { description: "Jam absen berubah setelah disetujui Admin HRD." })
      onOpenChange(false)
    } catch (e) {
      showError(form, e, "Pengajuan koreksi gagal")
    }
  })

  const c = form.control
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajukan koreksi absen</DialogTitle>
          <DialogDescription>
            Untuk absensi yang terlewat atau jamnya tidak sesuai, paling lama {CORRECTION_MAX_DAYS} hari ke belakang. Bila keduanya terlewat, ajukan koreksi check-in terlebih dahulu.
          </DialogDescription>
        </DialogHeader>
        <form id="correction-form" onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField control={c} name="date" label="Tanggal">
                {(f) => <DatePicker {...f} min={shift(today, -CORRECTION_MAX_DAYS)} max={today} />}
              </FormField>
              <FormField control={c} name="type" label="Tipe">
                {({ value, onChange, id }) => (
                  <Select value={value} onValueChange={onChange}>
                    <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CHECK_IN">Check-in</SelectItem>
                      <SelectItem value="CHECK_OUT">Check-out</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            </div>
            <FormField control={c} name="time" label="Jam sebenarnya" description="Jam saat Anda mulai / selesai bekerja.">
              {(f) => <Input {...f} type="time" className="sm:w-40" />}
            </FormField>
            <FormField control={c} name="reason" label="Alasan">
              {(f) => <Textarea {...f} rows={3} maxLength={255} placeholder="Lupa check-out karena listrik padam" />}
            </FormField>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button type="submit" form="correction-form" disabled={create.isPending}>{create.isPending && <Spinner />} Kirim koreksi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** HRD menyetujui / menolak pengajuan. Penolakan wajib disertai alasan. */
export function ReviewDialog({ kind, target, onOpenChange }: {
  kind: RequestKind
  target: { id: number; decision: "APPROVED" | "REJECTED"; title: string; summary: string } | null
  onOpenChange: (open: boolean) => void
}) {
  const review = useReviewRequest(kind)
  const form = useForm<ReviewValues>({ resolver: zodResolver(reviewSchema), defaultValues: { status: "APPROVED", note: "" } })
  useEffect(() => {
    if (target) form.reset({ status: target.decision, note: "" })
  }, [target, form])
  const approve = target?.decision === "APPROVED"

  const onSubmit = form.handleSubmit(async (v) => {
    if (!target) return
    try {
      await review.mutateAsync({ id: target.id, status: v.status, note: v.note || undefined })
      toast.success(approve ? "Pengajuan disetujui" : "Pengajuan ditolak", { description: target.title })
      onOpenChange(false)
    } catch (e) {
      showError(form, e, "Gagal memproses pengajuan")
    }
  })

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{approve ? "Setujui pengajuan?" : "Tolak pengajuan?"}</DialogTitle>
          <DialogDescription>
            <span className="text-foreground font-medium">{target?.title}</span> · {target?.summary}
          </DialogDescription>
        </DialogHeader>
        <form id="review-form" onSubmit={onSubmit} noValidate>
          <FormField control={form.control} name="note" label={approve ? "Catatan (opsional)" : "Alasan penolakan"}>
            {(f) => <Textarea {...f} rows={3} maxLength={255} placeholder={approve ? "" : "Tanggal bentrok dengan jadwal tutup buku"} />}
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button type="submit" form="review-form" variant={approve ? "default" : "destructive"} disabled={review.isPending}>
            {review.isPending && <Spinner />} {approve ? "Setujui" : "Tolak"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
