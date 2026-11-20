import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { z } from "zod"
import { FormField } from "@/components/form-field"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { useDeleteOrg, useSaveOrg } from "@/hooks/queries"
import { getErrorMessage, getFieldErrors } from "@/lib/api"
import { departmentSchema, positionSchema } from "@/lib/schemas"
import type { Department } from "@/types"

export type OrgKind = "departments" | "positions"
const LABEL: Record<OrgKind, string> = { departments: "departemen", positions: "jabatan" }

/** Tambah / ubah nama departemen. `target.id` kosong = tambah. */
export function DepartmentDialog({ target, onOpenChange }: {
  target: { id?: number; name?: string } | null
  onOpenChange: (open: boolean) => void
}) {
  const save = useSaveOrg("departments")
  const form = useForm<z.infer<typeof departmentSchema>>({ resolver: zodResolver(departmentSchema), defaultValues: { name: target?.name ?? "" } })
  const isEdit = !!target?.id

  const onSubmit = form.handleSubmit(async ({ name }) => {
    try {
      await save.mutateAsync({ id: target?.id, data: { name } })
      toast.success(isEdit ? "Nama departemen diperbarui" : "Departemen ditambahkan", { description: name })
      onOpenChange(false)
    } catch (e) {
      form.setError("name", { message: getFieldErrors(e).name ?? getErrorMessage(e) })
    }
  })

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Ubah nama departemen" : "Tambah departemen"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Perubahan nama langsung berlaku untuk semua karyawan di departemen ini." : "Jabatan dapat ditambahkan di menu Jabatan setelah departemen dibuat."}
          </DialogDescription>
        </DialogHeader>
        <form id="department-form" onSubmit={onSubmit} noValidate>
          <FormField control={form.control} name="name" label="Nama departemen">
            {(f) => <Input {...f} maxLength={80} placeholder="Marketing" autoComplete="off" />}
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button type="submit" form="department-form" disabled={save.isPending}>{save.isPending && <Spinner />} {isEdit ? "Simpan" : "Tambah"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const positionFormSchema = positionSchema.extend({ departmentId: z.string().min(1, "Departemen wajib dipilih") })

/**
 * Tambah jabatan (pilih departemen) atau ubah nama jabatan. Departemen jabatan tidak bisa dipindah
 * setelah dibuat, karena database mengunci pasangan (jabatan, departemen) yang dipakai karyawan.
 */
export function PositionDialog({ target, departments, onOpenChange }: {
  target: { id?: number; name?: string; departmentId?: number } | null
  departments: Department[]
  onOpenChange: (open: boolean) => void
}) {
  const save = useSaveOrg("positions")
  const isEdit = !!target?.id
  const form = useForm<z.infer<typeof positionFormSchema>>({
    resolver: zodResolver(positionFormSchema),
    defaultValues: { name: target?.name ?? "", departmentId: target?.departmentId ? String(target.departmentId) : "" },
  })
  const deptName = departments.find((d) => d.id === target?.departmentId)?.name

  const onSubmit = form.handleSubmit(async ({ name, departmentId }) => {
    try {
      await save.mutateAsync({ id: target?.id, data: isEdit ? { name } : { name, departmentId: Number(departmentId) } })
      toast.success(isEdit ? "Nama jabatan diperbarui" : "Jabatan ditambahkan", { description: name })
      onOpenChange(false)
    } catch (e) {
      const fe = getFieldErrors(e)
      const msg = getErrorMessage(e)
      if (fe.departmentId || /departemen/i.test(msg)) form.setError("departmentId", { message: fe.departmentId ?? msg })
      else form.setError("name", { message: fe.name ?? msg })
    }
  })

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Ubah nama jabatan" : "Tambah jabatan"}</DialogTitle>
          <DialogDescription>
            {isEdit ? `Departemen ${deptName ?? ""}. Perubahan nama langsung berlaku untuk karyawan dengan jabatan ini.` : "Setiap jabatan berada di bawah satu departemen."}
          </DialogDescription>
        </DialogHeader>
        <form id="position-form" onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-5">
            {!isEdit && (
              <FormField control={form.control} name="departmentId" label="Departemen">
                {({ value, onChange, id }) => (
                  <Select value={value} onValueChange={onChange}>
                    <SelectTrigger id={id} className="w-full"><SelectValue placeholder="Pilih departemen" /></SelectTrigger>
                    <SelectContent>
                      {departments.filter((d) => d.isActive).map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            )}
            <FormField control={form.control} name="name" label="Nama jabatan">
              {(f) => <Input {...f} maxLength={80} placeholder="Software Engineer" autoComplete="off" />}
            </FormField>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button type="submit" form="position-form" disabled={save.isPending}>{save.isPending && <Spinner />} {isEdit ? "Simpan" : "Tambah"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Konfirmasi hapus departemen / jabatan. Server menolak (409) bila masih dipakai karyawan. */
export function DeleteOrgDialog({ kind, target, onOpenChange }: {
  kind: OrgKind
  target: { id: number; name: string } | null
  onOpenChange: (open: boolean) => void
}) {
  const remove = useDeleteOrg(kind)
  const doDelete = async () => {
    if (!target) return
    try {
      await remove.mutateAsync(target.id)
      toast.success(`${target.name} dihapus`)
    } catch (e) {
      toast.error("Gagal menghapus", { description: getErrorMessage(e) })
    } finally {
      onOpenChange(false)
    }
  }
  return (
    <AlertDialog open={!!target} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus {LABEL[kind]} {target?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {kind === "departments"
              ? "Departemen beserta seluruh jabatannya akan dihapus permanen. Departemen yang masih dipakai karyawan tidak dapat dihapus; nonaktifkan saja."
              : "Jabatan akan dihapus permanen. Jabatan yang masih dipakai karyawan tidak dapat dihapus; nonaktifkan saja."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction className="bg-destructive hover:bg-destructive/90 text-white" disabled={remove.isPending} onClick={(e) => { e.preventDefault(); doDelete() }}>
            Hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
