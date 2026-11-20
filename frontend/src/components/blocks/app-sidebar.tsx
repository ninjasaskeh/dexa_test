import * as React from "react"
import {
  IconBriefcase,
  IconBuildingCommunity,
  IconCalendarCheck,
  IconCalendarOff,
  IconCameraSelfie,
  IconChecklist,
  IconFileDescription,
  IconLayoutDashboard,
  IconHistory,
  IconReportAnalytics,
  IconUsers,
} from "@tabler/icons-react"
import { Link } from "react-router"

import { NavMain } from "@/components/blocks/nav-main"
import { NavUser } from "@/components/blocks/nav-user"
import { useAuth } from "@/components/auth-provider"
import { usePendingCount } from "@/hooks/queries"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Logo } from "@/components/logo"

const employeeNav = [
  { title: "Absen Hari Ini", url: "/attendance", icon: IconCameraSelfie },
  { title: "Riwayat Absensi", url: "/history", icon: IconHistory },
  { title: "Pengajuan", url: "/requests", icon: IconFileDescription },
]

const hrNav = [
  { title: "Dashboard", url: "/dashboard", icon: IconLayoutDashboard },
  { title: "Data Karyawan", url: "/employees", icon: IconUsers },
  { title: "Departemen", url: "/departments", icon: IconBuildingCommunity },
  { title: "Jabatan", url: "/positions", icon: IconBriefcase },
  { title: "Monitoring Absensi", url: "/monitoring", icon: IconCalendarCheck },
  { title: "Rekap Bulanan", url: "/recap", icon: IconReportAnalytics },
  { title: "Persetujuan", url: "/approvals", icon: IconChecklist },
  { title: "Hari Libur", url: "/holidays", icon: IconCalendarOff },
]

/** Diadaptasi dari block shadcn dashboard-01 (app-sidebar) */
export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth()
  const isHr = user?.role === "HR_ADMIN"
  const pendingLeave = usePendingCount("leave", isHr)
  const pendingCorrections = usePendingCount("corrections", isHr)
  const pending = (pendingLeave.data ?? 0) + (pendingCorrections.data ?? 0)
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" className="hover:bg-transparent active:bg-transparent">
              <Link to="/">
                <Logo className="size-8!" />
                <div className="grid leading-tight">
                  <span className="text-sm font-semibold">Dexa Group</span>
                  <span className="text-muted-foreground text-xs">Absensi WFH</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {isHr && <NavMain label="Admin HRD" items={hrNav.map((n) => (n.url === "/approvals" ? { ...n, badge: pending } : n))} />}
        {user?.employee && <NavMain label="Absensi Saya" items={employeeNav} />}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
