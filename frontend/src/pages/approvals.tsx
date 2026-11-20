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
  const tab = params.get("tab") === "koreksi" ? "koreksi" : "cuti"
  const leave = usePendingCount("leave")
  const corrections = usePendingCount("corrections")

  return (
    <>
      <PageHeader
        title="Persetujuan"
        description="Koreksi yang disetujui langsung mengubah jam absen karyawan. Anda tidak dapat memproses pengajuan Anda sendiri."
      />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })} className="gap-4">
        <TabsList>
          <TabsTrigger value="cuti">Cuti / Izin / Sakit <Count n={leave.data} /></TabsTrigger>
          <TabsTrigger value="koreksi">Koreksi absen <Count n={corrections.data} /></TabsTrigger>
        </TabsList>
        <TabsContent value="cuti">
          <Card className="gap-0 overflow-hidden py-0">
            <CardContent className="px-0"><RequestsPanel kind="leave" scope="all" defaultStatus="PENDING" /></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="koreksi">
          <Card className="gap-0 overflow-hidden py-0">
            <CardContent className="px-0"><RequestsPanel kind="corrections" scope="all" defaultStatus="PENDING" /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  )
}
