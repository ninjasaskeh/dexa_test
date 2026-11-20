import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { IconInfoCircle } from "@tabler/icons-react";
import { DatePicker } from "@/components/date-picker"
import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup, FieldSeparator } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useSaveEmployee } from "@/hooks/queries";
import { getErrorMessage, getFieldErrors } from "@/lib/api";
import { toISODate } from "@/lib/format";
import { employeeSchema, type EmployeeFormValues } from "@/lib/schemas";
import type { Department, Employee } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: Employee | null;
  departments: Department[];
}

const empty = (): EmployeeFormValues => ({
  nip: "",
  fullName: "",
  email: "",
  departmentId: "",
  positionId: "",
  phone: "",
  joinDate: toISODate(new Date()),
  role: "EMPLOYEE",
  isActive: true,
});

/** Form tambah / ubah data karyawan (HRD). Password tidak diisi HRD: password awal = NIP. */
export function EmployeeFormDialog({
  open,
  onOpenChange,
  employee,
  departments,
}: Props) {
  const isEdit = !!employee;
  const save = useSaveEmployee();
  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
    defaultValues: empty(),
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      employee
        ? {
            nip: employee.nip,
            fullName: employee.fullName,
            email: employee.email ?? "",
            departmentId: String(employee.departmentId),
            positionId: String(employee.positionId),
            phone: employee.phone ?? "",
            joinDate: employee.joinDate,
            role: employee.role ?? "EMPLOYEE",
            isActive: employee.isActive,
          }
        : empty(),
    );
  }, [open, employee, form]);

  const departmentId = useWatch({
    control: form.control,
    name: "departmentId",
  });
  // pilihan yang nonaktif tetap ditampilkan bila sedang dipakai karyawan ini
  const deptOptions = useMemo(
    () =>
      departments.filter(
        (d) => d.isActive || String(d.id) === String(employee?.departmentId),
      ),
    [departments, employee],
  );
  const positionOptions = useMemo(
    () =>
      departments
        .find((d) => String(d.id) === departmentId)
        ?.positions.filter(
          (p) => p.isActive || String(p.id) === String(employee?.positionId),
        ) ?? [],
    [departments, departmentId, employee],
  );

  const onSubmit = form.handleSubmit(async (v) => {
    const payload: Record<string, unknown> = {
      ...v,
      departmentId: Number(v.departmentId),
      positionId: Number(v.positionId),
    };
    if (!isEdit) delete payload.isActive;
    try {
      const saved = await save.mutateAsync({ id: employee?.id, data: payload });
      toast.success(
        isEdit ? "Data karyawan diperbarui" : "Karyawan berhasil ditambahkan",
        {
          description: isEdit
            ? `${saved.fullName} (${saved.nip})`
            : `${saved.fullName} dapat masuk dengan NIP ${saved.nip} sebagai password awal.`,
        },
      );
      onOpenChange(false);
    } catch (e) {
      Object.entries(getFieldErrors(e)).forEach(([k, m]) =>
        form.setError(k as keyof EmployeeFormValues, { message: m }),
      );
      const msg = getErrorMessage(e);
      if (/email/i.test(msg)) form.setError("email", { message: msg });
      else if (/nip/i.test(msg)) form.setError("nip", { message: msg });
      else if (/jabatan/i.test(msg))
        form.setError("positionId", { message: msg });
      else if (/departemen/i.test(msg))
        form.setError("departmentId", { message: msg });
      toast.error("Gagal menyimpan", { description: msg });
    }
  });

  const c = form.control;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Ubah Data Karyawan" : "Tambah Karyawan"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Perbarui data kepegawaian dan akun karyawan."
              : "Lengkapi data kepegawaian dan akun karyawan baru."}
          </DialogDescription>
        </DialogHeader>
        <form id="employee-form" onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField control={c} name="nip" label="NIP">
                {(f) => (
                  <Input
                    {...f}
                    inputMode="numeric"
                    placeholder="20260045"
                    autoComplete="off"
                  />
                )}
              </FormField>
              <FormField control={c} name="fullName" label="Nama lengkap">
                {(f) => <Input {...f} placeholder="Budi Santoso" />}
              </FormField>
              <FormField control={c} name="departmentId" label="Departemen">
                {({ value, onChange, id }) => (
                  <Select
                    value={value}
                    onValueChange={(v) => {
                      onChange(v);
                      form.setValue("positionId", ""); // jabatan harus dipilih ulang dari departemen baru
                    }}
                  >
                    <SelectTrigger id={id} className="w-full">
                      <SelectValue placeholder="Pilih departemen" />
                    </SelectTrigger>
                    <SelectContent>
                      {deptOptions.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.name}
                          {!d.isActive && " (nonaktif)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
              <FormField control={c} name="positionId" label="Jabatan">
                {({ value, onChange, id }) => (
                  <Select
                    value={value}
                    onValueChange={onChange}
                    disabled={!departmentId}
                  >
                    <SelectTrigger id={id} className="w-full">
                      <SelectValue
                        placeholder={
                          departmentId
                            ? positionOptions.length
                              ? "Pilih jabatan"
                              : "Belum ada jabatan"
                            : "Pilih departemen dulu"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {positionOptions.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                          {!p.isActive && " (nonaktif)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
              <FormField control={c} name="phone" label="No. HP (opsional)">
                {(f) => (
                  <Input {...f} inputMode="tel" placeholder="081234567890" />
                )}
              </FormField>
              <FormField control={c} name="joinDate" label="Tanggal bergabung">
                {(f) => <DatePicker {...f} max={toISODate(new Date())} withYearSelect />}
              </FormField>
            </div>
            <FieldSeparator>Akun aplikasi</FieldSeparator>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField control={c} name="email" label="Email">
                {(f) => (
                  <Input
                    {...f}
                    type="email"
                    autoComplete="off"
                    placeholder="nama@dexa.local"
                  />
                )}
              </FormField>
              <FormField control={c} name="role" label="Hak akses">
                {({ value, onChange, id }) => (
                  <Select value={value} onValueChange={onChange}>
                    <SelectTrigger id={id} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EMPLOYEE">Karyawan</SelectItem>
                      <SelectItem value="HR_ADMIN">Admin HRD</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </FormField>
              {isEdit && (
                <FormField
                  control={c}
                  name="isActive"
                  label="Status akun"
                  description="Karyawan nonaktif tidak dapat masuk ke aplikasi."
                >
                  {({ value, onChange, id }) => (
                    <div className="flex h-9 items-center gap-3">
                      <Switch
                        id={id}
                        checked={value}
                        onCheckedChange={onChange}
                      />
                      <span className="text-sm">
                        {value ? "Aktif" : "Nonaktif"}
                      </span>
                    </div>
                  )}
                </FormField>
              )}
            </div>
            {!isEdit && (
              <Alert>
                <IconInfoCircle />
                <AlertDescription>
                  Password awal karyawan adalah NIP. Karyawan wajib menggantinya
                  saat pertama kali masuk.
                </AlertDescription>
              </Alert>
            )}
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button type="submit" form="employee-form" disabled={save.isPending}>
            {save.isPending && <Spinner />}
            {isEdit ? "Simpan perubahan" : "Tambah karyawan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
