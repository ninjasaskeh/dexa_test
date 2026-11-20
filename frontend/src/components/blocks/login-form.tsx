import { useState } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { IconAlertCircle, IconEye, IconEyeOff } from "@tabler/icons-react"

import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Logo } from "@/components/logo"
import { loginSchema, type LoginValues } from "@/lib/schemas"

const demoAccounts = [
  { role: "Admin HRD", name: "Sari Wulandari", email: "hr@dexa.local", password: "Admin123!" },
  { role: "Karyawan", name: "Budi Santoso", email: "budi@dexa.local", password: "Karyawan123!" },
  { role: "Karyawan", name: "Rina Putri", email: "rina@dexa.local", password: "Karyawan123!" },
]

/** Contoh kartu absen satu hari, untuk menjelaskan alur aplikasi tanpa ilustrasi generik */
function SampleTimecard() {
  const rows = [
    { label: "Check-in", time: "08:52", note: "Tepat waktu" },
    { label: "Check-out", time: "17:06", note: "8j 14m kerja" },
  ]
  return (
    <div className="w-full max-w-xs rounded-xl bg-white p-4 text-neutral-900 shadow-[0_24px_48px_-12px_rgb(0_0_0/0.35)]">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-neutral-500">Kamis, 13 November</p>
          <p className="text-sm font-semibold">Absensi WFH</p>
        </div>
        <span className="rounded-md bg-success/10 px-1.5 py-0.5 text-xs font-medium text-success">Lengkap</span>
      </div>
      <ul className="mt-4 space-y-2">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3 rounded-lg border border-neutral-200 p-2.5">
            <div className="size-9 shrink-0 rounded-md bg-[repeating-linear-gradient(135deg,#f3f2f0_0_6px,#e9e7e5_6px_12px)]" aria-hidden />
            <div className="flex-1">
              <p className="text-xs text-neutral-500">{r.label}</p>
              <p className="text-base font-semibold tabular-nums">{r.time}</p>
            </div>
            <span className="text-xs text-neutral-500">{r.note}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Diadaptasi dari block shadcn login-04, terhubung ke API login (JWT) */
export function LoginForm({
  className,
  onLogin,
  ...props
}: Omit<React.ComponentProps<"div">, "onSubmit"> & { onLogin: (v: LoginValues) => Promise<void> }) {
  const [serverError, setServerError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } })

  const submit = form.handleSubmit(async (v) => {
    setServerError(null)
    try {
      await onLogin(v)
    } catch (e) {
      setServerError(e instanceof Error ? e.message : String(e))
    }
  })

  return (
    <div className={cn("grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]", className)} {...props}>
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <div className="flex items-center gap-2.5">
          <Logo className="size-8" />
          <div className="leading-tight">
            <p className="text-sm font-semibold">Dexa Group</p>
            <p className="text-muted-foreground text-xs">Absensi WFH</p>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-2xl font-semibold">Masuk</h1>
          <p className="text-muted-foreground mt-1 text-sm">Gunakan email kantor yang didaftarkan HRD.</p>

          <form className="mt-8" onSubmit={submit} noValidate>
            <FieldGroup className="gap-5">
              {serverError && (
                <Alert variant="destructive">
                  <IconAlertCircle />
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}
              <Controller
                name="email"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input {...field} id="email" type="email" autoComplete="email" placeholder="nama@dexa.local" className="h-10" aria-invalid={fieldState.invalid} />
                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="password"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <div className="relative">
                      <Input {...field} id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" className="h-10 pr-10" aria-invalid={fieldState.invalid} />
                      <Button type="button" variant="ghost" size="icon-sm" className="text-muted-foreground absolute top-1 right-1" aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"} onClick={() => setShowPassword((s) => !s)}>
                        {showPassword ? <IconEyeOff /> : <IconEye />}
                      </Button>
                    </div>
                    {fieldState.error && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Button type="submit" size="lg" className="h-10 w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Spinner />}
                Masuk
              </Button>
            </FieldGroup>
          </form>

          <div className="mt-10">
            <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">Akun demo</p>
            <ul className="divide-y rounded-lg border">
              {demoAccounts.map((a) => (
                <li key={a.email}>
                  <button
                    type="button"
                    className="hover:bg-muted/60 flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors first:rounded-t-lg last:rounded-b-lg"
                    onClick={() => {
                      form.setValue("email", a.email, { shouldValidate: true })
                      form.setValue("password", a.password, { shouldValidate: true })
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{a.name}</span>
                      <span className="text-muted-foreground block truncate text-xs">{a.email}</span>
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">{a.role}</span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-2 text-xs">Klik salah satu untuk mengisi form.</p>
          </div>
        </div>

        <p className="text-muted-foreground text-xs">© {new Date().getFullYear()} Dexa Group</p>
      </div>

      <div className="bg-primary relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* garis jam kerja tipis sebagai tekstur, bukan gradient */}
        <div aria-hidden className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgb(255_255_255/0.045)_0_1px,transparent_1px_72px)]" />
        <p className="text-primary-foreground/80 relative text-sm font-medium">Work from home, tercatat rapi.</p>
        <div className="relative flex flex-1 items-center justify-center py-12">
          <SampleTimecard />
        </div>
        <div className="text-primary-foreground relative max-w-md space-y-2">
          <h2 className="text-3xl leading-tight font-semibold">Satu foto saat mulai, satu saat selesai.</h2>
          <p className="text-primary-foreground/75 text-sm leading-relaxed">
            Jam dicatat oleh server, bukan perangkat Anda. HRD melihat kehadiran tim secara langsung.
          </p>
        </div>
      </div>
    </div>
  )
}
