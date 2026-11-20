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

type Tab = "cuti" | "koreksi"

/**
 * Pengajuan karyawan: cuti/izin/sakit dan koreksi absen.
 * `?tab=koreksi&date=YYYY-MM-DD&type=CHECK_OUT` langsung membuka form koreksi yang sudah terisi.
 */
export default function RequestsPage() {
  const { user } = useAuth()
  const today = useTodayAttendance().data?.date
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get("tab") === "koreksi" ? "koreksi" : "cuti"
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
    if (!open && prefill) setParams({ tab: "koreksi" }, { replace: true })
  }

  return (
    <>
      <PageHeader title="Pengajuan" description="Ajukan cuti, izin, sakit, atau koreksi jam absen. Admin HRD akan meninjau pengajuan Anda." />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })} className="gap-4">
        <TabsList>
          <TabsTrigger value="cuti">Cuti / Izin / Sakit</TabsTrigger>
          <TabsTrigger value="koreksi">Koreksi absen</TabsTrigger>
        </TabsList>
        <TabsContent value="cuti">
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
        <TabsContent value="koreksi">
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
