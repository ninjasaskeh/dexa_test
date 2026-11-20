import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FieldGroup, FieldSeparator } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { useSaveEmployee } from "@/hooks/queries"
import { getErrorMessage, getFieldErrors } from "@/lib/api"
import { toISODate } from "@/lib/format"
import { createEmployeeSchema, updateEmployeeSchema, type EmployeeFormValues } from "@/lib/schemas"
import type { Employee } from "@/types"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  employee?: Employee | null
  departments: string[]
}

const empty: EmployeeFormValues = {
  fullName: "", employeeCode: "", email: "", password: "", position: "", department: "", phone: "",
  joinDate: toISODate(new Date()), role: "EMPLOYEE", isActive: true,
}

/** Form tambah / ubah data karyawan (HRD) */
export function EmployeeFormDialog({ open, onOpenChange, employee, departments }: Props) {
  const isEdit = !!employee
  const save = useSaveEmployee()
  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(isEdit ? updateEmployeeSchema : createEmployeeSchema) as never,
    defaultValues: empty,
  })

  useEffect(() => {
    if (!open) return
    form.reset(
      employee
        ? {
            fullName: employee.fullName, employeeCode: employee.employeeCode, email: employee.email ?? "", password: "",
            position: employee.position, department: employee.department, phone: employee.phone ?? "",
            joinDate: employee.joinDate, role: employee.role ?? "EMPLOYEE", isActive: employee.isActive,
          }
        : empty,
    )
  }, [open, employee, form])

  const onSubmit = form.handleSubmit(async (v) => {
    const payload: Record<string, unknown> = { ...v, employeeCode: v.employeeCode.toUpperCase() }
    if (isEdit && !v.password) delete payload.password
    if (!isEdit) delete payload.isActive
    try {
      const saved = await save.mutateAsync({ id: employee?.id, data: payload })
      toast.success(isEdit ? "Data karyawan diperbarui" : "Karyawan berhasil ditambahkan", { description: `${saved.fullName} (${saved.employeeCode})` })
      onOpenChange(false)
    } catch (e) {
      const fe = getFieldErrors(e)
      Object.entries(fe).forEach(([k, m]) => form.setError(k as keyof EmployeeFormValues, { message: m }))
      const msg = getErrorMessage(e)
      if (/email/i.test(msg)) form.setError("email", { message: msg })
      else if (/kode/i.test(msg)) form.setError("employeeCode", { message: msg })
      toast.error("Gagal menyimpan", { description: msg })
    }
  })

  const c = form.control
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Ubah Data Karyawan" : "Tambah Karyawan"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Perbarui profil dan akun login karyawan." : "Karyawan akan bisa login dengan email & password ini."}
          </DialogDescription>
        </DialogHeader>
        <form id="employee-form" onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField control={c} name="fullName" label="Nama lengkap">{(f) => <Input {...f} placeholder="Budi Santoso" />}</FormField>
              <FormField control={c} name="employeeCode" label="Kode karyawan">{(f) => <Input {...f} placeholder="EMP-010" className="uppercase" />}</FormField>
              <FormField control={c} name="position" label="Jabatan">{(f) => <Input {...f} placeholder="Software Engineer" />}</FormField>
              <FormField control={c} name="department" label="Departemen">
                {(f) => (
                  <>
                    <Input {...f} list="departments" placeholder="IT" />
                    <datalist id="departments">{departments.map((d) => <option key={d} value={d} />)}</datalist>
                  </>
                )}
              </FormField>
              <FormField control={c} name="phone" label="No. HP (opsional)">{(f) => <Input {...f} inputMode="tel" placeholder="081234567890" />}</FormField>
              <FormField control={c} name="joinDate" label="Tanggal bergabung">{(f) => <Input {...f} type="date" max={toISODate(new Date())} />}</FormField>
            </div>
            <FieldSeparator>Akun login</FieldSeparator>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField control={c} name="email" label="Email">{(f) => <Input {...f} type="email" autoComplete="off" placeholder="nama@dexa.local" />}</FormField>
              <FormField
                control={c}
                name="password"
                label={isEdit ? "Password baru" : "Password"}
                description={isEdit ? "Kosongkan jika tidak ingin mengganti." : "Min. 8 karakter, ada huruf besar & angka."}
              >
                {(f) => <Input {...f} type="password" autoComplete="new-password" />}
              </FormField>
              <FormField control={c} name="role" label="Hak akses">
                {({ value, onChange, id }) => (
                  <Select value={value} onValueChange={onChange}>
                    <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPLOYEE">Karyawan</SelectItem>
                      <SelectItem value="HR_ADMIN">Admin HRD</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </FormField>
              {isEdit && (
                <FormField control={c} name="isActive" label="Status akun" description="Karyawan nonaktif tidak dapat login.">
                  {({ value, onChange, id }) => (
                    <div className="flex h-9 items-center gap-3">
                      <Switch id={id} checked={value} onCheckedChange={onChange} />
                      <span className="text-sm">{value ? "Aktif" : "Nonaktif"}</span>
                    </div>
                  )}
                </FormField>
              )}
            </div>
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button type="submit" form="employee-form" disabled={save.isPending}>
            {save.isPending && <Spinner />}
            {isEdit ? "Simpan perubahan" : "Tambah karyawan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
