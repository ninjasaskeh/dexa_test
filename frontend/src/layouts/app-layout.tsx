import type { CSSProperties } from "react"
import { Navigate, Outlet, useLocation, useMatches } from "react-router"
import { AppSidebar } from "@/components/blocks/app-sidebar"
import { SiteHeader } from "@/components/blocks/site-header"
import { useAuth } from "@/components/auth-provider"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
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
export const homePath = (role?: Role) => (role === "HR_ADMIN" ? "/dashboard" : "/absen")

/** Guard: wajib login (opsional: role tertentu) */
export function RequireAuth({ role }: { role?: Role }) {
  const { status, user } = useAuth()
  const location = useLocation()
  if (status === "loading") return <FullPageLoader />
  if (status === "guest") return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (role && user?.role !== role) return <Navigate to={homePath(user?.role)} replace />
  return <Outlet />
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
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
