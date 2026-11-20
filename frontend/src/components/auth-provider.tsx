import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { api, setUnauthorizedHandler, TOKEN_KEY } from "@/lib/api"
import type { LoginValues } from "@/lib/schemas"
import type { CurrentUser } from "@/types"

interface AuthCtx {
  user: CurrentUser | null
  status: "loading" | "authenticated" | "guest"
  login: (v: LoginValues) => Promise<CurrentUser>
  logout: () => void
  refresh: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [status, setStatus] = useState<AuthCtx["status"]>(() => (localStorage.getItem(TOKEN_KEY) ? "loading" : "guest"))

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
    setStatus("guest")
    qc.clear()
  }, [qc])

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get<CurrentUser>("/auth/me")
      setUser(data)
      setStatus("authenticated")
    } catch {
      logout()
    }
  }, [logout])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    if (localStorage.getItem(TOKEN_KEY)) void refresh()
  }, [logout, refresh])

  const login = useCallback(async (v: LoginValues) => {
    const { data } = await api.post<{ accessToken: string; user: CurrentUser }>("/auth/login", v)
    localStorage.setItem(TOKEN_KEY, data.accessToken)
    setUser(data.user)
    setStatus("authenticated")
    return data.user
  }, [])

  const value = useMemo(() => ({ user, status, login, logout, refresh }), [user, status, login, logout, refresh])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider")
  return ctx
}
