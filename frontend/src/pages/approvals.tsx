import { useSearchParams } from "react-router"
import { PageHeader } from "@/components/page-header"
import { RequestsPanel } from "@/components/requests-panel"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { usePendingCount } from "@/hooks/queries"

function Count({ n }: { n?: number }) {
  return n ? <Badge className="h-5 min-w-5 rounded-full px-1.5 tabular-nums">{n}</Badge> : null
}

/** HRD: tinjau pengajuan cuti/izin/sakit dan koreksi absen */
export default function ApprovalsPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get("tab") === "corrections" ? "corrections" : "leave"
  const leave = usePendingCount("leave")
  const corrections = usePendingCount("corrections")

  return (
    <>
      <PageHeader
        title="Persetujuan"
        description="Tinjau pengajuan cuti, izin, sakit, dan koreksi absensi dari karyawan."
      />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })} className="gap-4">
        <TabsList>
          <TabsTrigger value="leave">Cuti / Izin / Sakit <Count n={leave.data} /></TabsTrigger>
          <TabsTrigger value="corrections">Koreksi absen <Count n={corrections.data} /></TabsTrigger>
        </TabsList>
        <TabsContent value="leave">
          <Card className="gap-0 overflow-hidden py-0">
            <CardContent className="px-0"><RequestsPanel kind="leave" scope="all" defaultStatus="PENDING" /></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="corrections">
          <Card className="gap-0 overflow-hidden py-0">
            <CardContent className="px-0"><RequestsPanel kind="corrections" scope="all" defaultStatus="PENDING" /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}
