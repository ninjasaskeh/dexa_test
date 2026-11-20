import { Navigate, useLocation, useNavigate } from "react-router"
import { toast } from "sonner"
import { LoginForm } from "@/components/blocks/login-form"
import { useAuth } from "@/components/auth-provider"
import { FullPageLoader, homePath } from "@/layouts/app-layout"
import { getErrorMessage } from "@/lib/api"

export default function LoginPage() {
  const { status, user, login } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from

  if (status === "loading") return <FullPageLoader />
  if (status === "authenticated") return <Navigate to={homePath(user?.role)} replace />

  return (
    <div className="bg-background">
      <div>
        <LoginForm
          onLogin={async (v) => {
            try {
              const u = await login(v)
              toast.success(`Masuk sebagai ${u.employee?.fullName ?? u.email}`)
              navigate(from && from !== "/" ? from : homePath(u.role), { replace: true })
            } catch (e) {
              throw new Error(getErrorMessage(e))
            }
          }}
        />
      </div>
    </div>
  )
}
