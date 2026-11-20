import type { CSSProperties } from "react"
import { Link, Navigate, Outlet, useLocation, useMatches } from "react-router"
import { IconAlertTriangle } from "@tabler/icons-react"
import { AppSidebar } from "@/components/blocks/app-sidebar"
import { SiteHeader } from "@/components/blocks/site-header"
import { useAuth } from "@/components/auth-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import type { Role } from "@/types"

export function FullPageLoader() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <Spinner className="size-8 text-primary" />
    </div>
  )
}

/** Halaman default sesuai role */
export const homePath = (role?: Role) => (role === "HR_ADMIN" ? "/dashboard" : "/attendance")

/** Guard: wajib login (opsional: role tertentu) */
export function RequireAuth({ role }: { role?: Role }) {
  const { status, user } = useAuth()
  const location = useLocation()
  if (status === "loading") return <FullPageLoader />
  if (status === "guest") return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (role && user?.role !== role) return <Navigate to={homePath(user?.role)} replace />
  return <Outlet />
}

/** Peringatan di atas semua halaman selama password akun masih NIP (akun baru) */
function PasswordWarning() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  if (!user?.mustChangePassword) return null
  return (
    <div role="alert" className="border-warning/40 bg-warning/10 flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center">
      <IconAlertTriangle className="text-warning-foreground size-5 shrink-0" aria-hidden />
      <div className="flex-1 text-sm">
        <p className="text-warning-foreground font-medium">Password Anda masih menggunakan NIP</p>
        <p className="text-muted-foreground">Segera ganti password agar akun tidak mudah diakses orang lain.</p>
      </div>
      {pathname !== "/profile" && (
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link to="/profile#change-password">Ganti password</Link>
        </Button>
      )}
    </div>
  )
}

/** Layout dashboard: sidebar + header (block shadcn dashboard-01) */
export function AppLayout() {
  const matches = useMatches()
  const handles = [...matches].reverse().map((m) => m.handle as { title?: string; section?: string } | undefined)
  const title = handles.map((h) => h?.title).find(Boolean) ?? "Dexa WFH"
  const section = handles.map((h) => h?.section).find(Boolean)
  return (
    <SidebarProvider style={{ "--sidebar-width": "calc(var(--spacing) * 64)", "--header-height": "calc(var(--spacing) * 14)" } as CSSProperties}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title={title} section={section} />
        <main className="@container/main mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
          <PasswordWarning />
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
