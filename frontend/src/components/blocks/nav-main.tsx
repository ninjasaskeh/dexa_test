import type { Icon } from "@tabler/icons-react"
import { NavLink, useLocation } from "react-router"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export interface NavItem {
  title: string
  url: string
  icon?: Icon
  /** angka kecil di kanan menu, mis. jumlah pengajuan menunggu */
  badge?: number
}

/** Diadaptasi dari block shadcn dashboard-01 (nav-main) + react-router */
export function NavMain({ label, items }: { label: string; items: NavItem[] }) {
  const { pathname } = useLocation()
  const { setOpenMobile } = useSidebar()
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent className="flex flex-col gap-1">
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.url}>
              <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={pathname.startsWith(item.url)}
                className="text-foreground/75 data-[active=true]:bg-card data-[active=true]:text-primary data-[active=true]:shadow-xs dark:data-[active=true]:bg-sidebar-accent"
              >
                <NavLink to={item.url} onClick={() => setOpenMobile(false)}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
              {!!item.badge && <SidebarMenuBadge className="bg-primary text-primary-foreground peer-data-[active=true]/menu-button:text-primary-foreground rounded-full">{item.badge}</SidebarMenuBadge>}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
