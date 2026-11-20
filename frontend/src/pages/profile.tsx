import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { useAuth } from "@/components/auth-provider"
import { FormField } from "@/components/form-field"
import { PageHeader } from "@/components/page-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Spinner } from "@/components/ui/spinner"
import { api, getErrorMessage } from "@/lib/api"
import { fmtDateLong, initials } from "@/lib/format"
import { changePasswordSchema, type ChangePasswordValues } from "@/lib/schemas"

export default function ProfilePage() {
  const { user } = useAuth()
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  })
  if (!user) return null
  const e = user.employee
  const name = e?.fullName ?? user.email

  const onSubmit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await api.patch("/auth/password", { currentPassword, newPassword })
      toast.success("Password berhasil diubah")
      form.reset()
    } catch (err) {
      const msg = getErrorMessage(err)
      if (/lama/i.test(msg)) form.setError("currentPassword", { message: msg })
      toast.error("Gagal mengubah password", { description: msg })
    }
  })

  const rows: [string, string][] = e
    ? [["Kode karyawan", e.employeeCode], ["Jabatan", e.position], ["Departemen", e.department], ["No. HP", e.phone ?? "-"], ["Bergabung", fmtDateLong(e.joinDate)]]
    : []

  return (
    <>
      <PageHeader title="Profil & Keamanan" description="Informasi akun dan pengaturan password." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-4">
            <Avatar className="size-14">
              <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">{initials(name)}</AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <CardTitle>{name}</CardTitle>
              <CardDescription>{user.email}</CardDescription>
              <Badge variant={user.role === "HR_ADMIN" ? "default" : "secondary"}>{user.role === "HR_ADMIN" ? "Admin HRD" : "Karyawan"}</Badge>
            </div>
          </CardHeader>
          <Separator />
          <CardContent>
            <dl className="divide-y">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 py-2.5 text-sm">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-muted-foreground mt-3 text-xs">Perubahan data profil dilakukan oleh Admin HRD.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ganti Password</CardTitle>
            <CardDescription>Min. 8 karakter, mengandung huruf besar dan angka.</CardDescription>
          </CardHeader>
          <CardContent>
            <form id="password-form" onSubmit={onSubmit} noValidate>
              <FieldGroup>
                <FormField control={form.control} name="currentPassword" label="Password lama">{(f) => <Input {...f} type="password" autoComplete="current-password" />}</FormField>
                <FormField control={form.control} name="newPassword" label="Password baru">{(f) => <Input {...f} type="password" autoComplete="new-password" />}</FormField>
                <FormField control={form.control} name="confirmPassword" label="Konfirmasi password baru">{(f) => <Input {...f} type="password" autoComplete="new-password" />}</FormField>
              </FieldGroup>
            </form>
          </CardContent>
          <CardFooter>
            <Button type="submit" form="password-form" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Spinner />}
              Simpan password
            </Button>
          </CardFooter>
        </Card>
      </div>
    </>
  )
}
