import { useMemo, useState } from "react"
import { useSearchParams } from "react-router"
import { IconPlus } from "@tabler/icons-react"
import { useAuth } from "@/components/auth-provider"
import { PageHeader } from "@/components/page-header"
import { CorrectionFormDialog, LeaveFormDialog } from "@/components/request-dialogs"
import { RequestsPanel } from "@/components/requests-panel"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useTodayAttendance } from "@/hooks/queries"
import type { CorrectionValues } from "@/lib/schemas"

type Tab = "leave" | "corrections"

/**
 * Pengajuan karyawan: cuti/izin/sakit dan koreksi absen.
 * `?tab=corrections&date=YYYY-MM-DD&type=CHECK_OUT` langsung membuka form koreksi yang sudah terisi.
 */
export default function RequestsPage() {
  const { user } = useAuth()
  const today = useTodayAttendance().data?.date
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get("tab") === "corrections" ? "corrections" : "leave"
  const prefill = useMemo<Partial<CorrectionValues> | undefined>(() => {
    const date = params.get("date")
    const type = params.get("type")
    if (!date) return undefined
    return { date, ...(type === "CHECK_IN" || type === "CHECK_OUT" ? { type } : {}) }
  }, [params])
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [correctionOpen, setCorrectionOpen] = useState(!!prefill)

  if (!user?.employee) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Profil karyawan belum tersedia</EmptyTitle>
          <EmptyDescription>Akun Anda belum terhubung ke data karyawan. Hubungi Admin HRD.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const closeCorrection = (open: boolean) => {
    setCorrectionOpen(open)
    // hapus prefill dari URL agar tidak terbuka lagi saat refresh
    if (!open && prefill) setParams({ tab: "corrections" }, { replace: true })
  }

  return (
    <>
      <PageHeader title="Pengajuan" description="Ajukan cuti, izin, sakit, atau koreksi absensi, dan pantau status persetujuannya." />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })} className="gap-4">
        <TabsList>
          <TabsTrigger value="leave">Cuti / Izin / Sakit</TabsTrigger>
          <TabsTrigger value="corrections">Koreksi absen</TabsTrigger>
        </TabsList>
        <TabsContent value="leave">
          <Card className="gap-0 overflow-hidden py-0">
            <CardContent className="px-0">
              <RequestsPanel
                kind="leave"
                scope="me"
                toolbar={<Button onClick={() => setLeaveOpen(true)} disabled={!today}><IconPlus /> Ajukan cuti / izin</Button>}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="corrections">
          <Card className="gap-0 overflow-hidden py-0">
            <CardContent className="px-0">
              <RequestsPanel
                kind="corrections"
                scope="me"
                toolbar={<Button onClick={() => setCorrectionOpen(true)} disabled={!today}><IconPlus /> Ajukan koreksi</Button>}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {today && <LeaveFormDialog open={leaveOpen} onOpenChange={setLeaveOpen} today={today} />}
      {today && <CorrectionFormDialog open={correctionOpen} onOpenChange={closeCorrection} today={today} initial={prefill} />}
    </>
  )
}
