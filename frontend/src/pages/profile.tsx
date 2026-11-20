import { useEffect } from "react"
import { useLocation } from "react-router"
import { useAuth } from "@/components/auth-provider"
import { ChangePasswordForm } from "@/components/change-password-form"
import { PageHeader } from "@/components/page-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { fmtDateLong, initials } from "@/lib/format"

export default function ProfilePage() {
  const { user, refresh } = useAuth()
  const { hash } = useLocation()
  // dari banner "Ganti password": langsung ke form dan fokus ke kolom pertama
  useEffect(() => {
    if (hash !== "#change-password") return
    const card = document.getElementById("change-password")
    card?.scrollIntoView({ behavior: "smooth", block: "start" })
    card?.querySelector("input")?.focus({ preventScroll: true })
  }, [hash])
  if (!user) return null
  const e = user.employee
  const name = e?.fullName ?? user.email

  const rows: [string, string][] = e
    ? [["NIP", e.nip], ["Jabatan", e.position], ["Departemen", e.department], ["No. HP", e.phone ?? "-"], ["Bergabung", fmtDateLong(e.joinDate)]]
    : []

  return (
    <>
      <PageHeader title="Profil & Keamanan" description="Informasi akun dan pengaturan keamanan." />
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

        <Card id="change-password" className="scroll-mt-20">
          <CardHeader>
            <CardTitle>Ganti Password</CardTitle>
            <CardDescription>Gunakan password yang tidak dipakai di layanan lain.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm currentLabel={user.mustChangePassword ? "Password saat ini (NIP)" : "Password lama"} onDone={refresh} />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
