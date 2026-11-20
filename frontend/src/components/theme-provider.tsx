import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

type Theme = "light" | "dark" | "system"
interface ThemeCtx { theme: Theme; setTheme: (t: Theme) => void }

/** Default tema: terang. "system" hanya dipakai bila user memilihnya di menu. */
const Ctx = createContext<ThemeCtx>({ theme: "light", setTheme: () => {} })
const KEY = "dexa.theme"

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try { return (localStorage.getItem(KEY) as Theme) || "light" } catch { return "light" }
  })

  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const apply = () => root.classList.toggle("dark", theme === "dark" || (theme === "system" && media.matches))
    apply()
    media.addEventListener("change", apply)
    return () => media.removeEventListener("change", apply)
  }, [theme])

  const setTheme = (t: Theme) => {
    try { localStorage.setItem(KEY, t) } catch { /* abaikan */ }
    setThemeState(t)
  }
  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(Ctx)
