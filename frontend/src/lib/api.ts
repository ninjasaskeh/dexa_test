import axios, { AxiosError } from "axios"

export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3000").replace(/\/$/, "")
export const TOKEN_KEY = "dexa.token"

export const api = axios.create({ baseURL: `${API_URL}/api`, timeout: 15000 })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

/** Dipanggil AuthProvider saat sesi habis (401) */
let onUnauthorized: (() => void) | null = null
export const setUnauthorizedHandler = (fn: () => void) => (onUnauthorized = fn)

api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    const isLogin = err.config?.url?.includes("/auth/login")
    if (err.response?.status === 401 && !isLogin) onUnauthorized?.()
    return Promise.reject(err)
  },
)

export interface ApiErrorBody {
  statusCode: number
  message: string | string[]
  errors?: Record<string, string>
}

/** Ambil pesan error yang ramah dari response backend */
export function getErrorMessage(err: unknown, fallback = "Terjadi kesalahan, coba lagi"): string {
  if (axios.isAxiosError<ApiErrorBody>(err)) {
    if (!err.response) return "Tidak dapat terhubung ke server. Pastikan backend berjalan."
    const m = err.response.data?.message
    if (Array.isArray(m)) return m.join(", ")
    return m || fallback
  }
  return err instanceof Error ? err.message : fallback
}

/** Error validasi per field dari backend (ZodValidationPipe) */
export function getFieldErrors(err: unknown): Record<string, string> {
  if (axios.isAxiosError<ApiErrorBody>(err)) return err.response?.data?.errors ?? {}
  return {}
}

/** Unduh file (CSV) dari endpoint yang butuh token, lalu simpan lewat browser */
export async function downloadFile(url: string, params: Record<string, unknown>, fallbackName: string) {
  try {
    const res = await api.get<Blob>(url, { params, responseType: "blob" })
    const name = /filename="?([^";]+)"?/.exec(String(res.headers["content-disposition"] ?? ""))?.[1] ?? fallbackName
    const href = URL.createObjectURL(res.data)
    const a = Object.assign(document.createElement("a"), { href, download: name })
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(href), 1000)
  } catch (err) {
    // responseType blob: body error JSON juga datang sebagai Blob, ubah dulu agar getErrorMessage bisa membacanya
    if (axios.isAxiosError(err) && err.response?.data instanceof Blob) {
      try {
        err.response.data = JSON.parse(await err.response.data.text())
      } catch {
        /* biarkan apa adanya */
      }
    }
    throw err
  }
}
