import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { FormField } from "@/components/form-field"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { api, getErrorMessage } from "@/lib/api"
import { changePasswordSchema, type ChangePasswordValues } from "@/lib/schemas"

/** Form ganti password; dipakai di halaman Profil dan halaman wajib ganti password (login pertama) */
export function ChangePasswordForm({ currentLabel = "Password lama", submitLabel = "Simpan password", onDone }: {
  currentLabel?: string
  submitLabel?: string
  onDone?: () => void | Promise<void>
}) {
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  })

  const onSubmit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await api.patch("/auth/password", { currentPassword, newPassword })
      toast.success("Password berhasil diubah")
      form.reset()
      await onDone?.()
    } catch (err) {
      const msg = getErrorMessage(err)
      if (/lama/i.test(msg)) form.setError("currentPassword", { message: msg })
      toast.error("Gagal mengubah password", { description: msg })
    }
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <FieldGroup>
        <FormField control={form.control} name="currentPassword" label={currentLabel}>{(f) => <Input {...f} type="password" autoComplete="current-password" />}</FormField>
        <FormField control={form.control} name="newPassword" label="Password baru" description="Minimal 8 karakter, mengandung huruf besar dan angka.">
          {(f) => <Input {...f} type="password" autoComplete="new-password" />}
        </FormField>
        <FormField control={form.control} name="confirmPassword" label="Konfirmasi password baru">{(f) => <Input {...f} type="password" autoComplete="new-password" />}</FormField>
      </FieldGroup>
      <Button type="submit" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting && <Spinner />}
        {submitLabel}
      </Button>
    </form>
  )
}
