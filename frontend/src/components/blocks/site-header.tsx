import { IconMoon, IconSun } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useTheme } from "@/components/theme-provider"

/** Diadaptasi dari block shadcn dashboard-01 (site-header) */
export function SiteHeader({ title, section }: { title: string; section?: string }) {
  const { theme, setTheme } = useTheme()
  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)
  return (
    <header className="sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background/85 backdrop-blur md:rounded-t-xl transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
        <nav aria-label="Lokasi halaman" className="flex min-w-0 items-center gap-1.5 text-sm">
          {section && <span className="text-muted-foreground hidden sm:inline">{section}</span>}
          {section && <span className="text-muted-foreground/50 hidden sm:inline">/</span>}
          <h1 className="truncate font-medium">{title}</h1>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" aria-label="Ganti tema" onClick={() => setTheme(isDark ? "light" : "dark")}>
            {isDark ? <IconSun /> : <IconMoon />}
          </Button>
        </div>
      </div>
    </header>
  )
}
