import type React from "react"
import { createBrowserRouter, Navigate, RouterProvider } from "react-router"
import { useAuth } from "@/components/auth-provider"
import { AppLayout, homePath, RequireAuth } from "@/layouts/app-layout"
import LoginPage from "@/pages/login"
import NotFoundPage from "@/pages/not-found"

/** Code-splitting per halaman */
const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({ Component: (await load()).default })

function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={homePath(user?.role)} replace />
}

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <HomeRedirect /> },
          { path: "absen", lazy: page(() => import("@/pages/attendance")), handle: { title: "Absen Hari Ini", section: "Absensi Saya" } },
          { path: "riwayat", lazy: page(() => import("@/pages/history")), handle: { title: "Riwayat Absensi", section: "Absensi Saya" } },
          { path: "pengajuan", lazy: page(() => import("@/pages/requests")), handle: { title: "Pengajuan", section: "Absensi Saya" } },
          { path: "profil", lazy: page(() => import("@/pages/profile")), handle: { title: "Profil", section: "Akun" } },
          {
            element: <RequireAuth role="HR_ADMIN" />,
            children: [
              { path: "dashboard", lazy: page(() => import("@/pages/dashboard")), handle: { title: "Dashboard", section: "Admin HRD" } },
              { path: "karyawan", lazy: page(() => import("@/pages/employees")), handle: { title: "Data Karyawan", section: "Admin HRD" } },
              { path: "monitoring", lazy: page(() => import("@/pages/monitoring")), handle: { title: "Monitoring Absensi", section: "Admin HRD" } },
              { path: "rekap", lazy: page(() => import("@/pages/recap")), handle: { title: "Rekap Bulanan", section: "Admin HRD" } },
              { path: "persetujuan", lazy: page(() => import("@/pages/approvals")), handle: { title: "Persetujuan", section: "Admin HRD" } },
              { path: "hari-libur", lazy: page(() => import("@/pages/holidays")), handle: { title: "Hari Libur", section: "Admin HRD" } },
            ],
          },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
])

export default function App() {
  return <RouterProvider router={router} />
}
