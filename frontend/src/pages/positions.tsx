import { useMemo, useState } from "react"
import { toast } from "sonner"
import { IconDotsVertical, IconPencil, IconPlus, IconSearch, IconToggleLeft, IconToggleRight, IconTrash } from "@tabler/icons-react"
import { ActiveBadge } from "@/components/attendance-badge"
import { DeleteOrgDialog, PositionDialog } from "@/components/organization-dialogs"
import { PageHeader } from "@/components/page-header"
import { TableMessage, TableSkeletonRows } from "@/components/table-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDepartments, usePositions, useSaveOrg } from "@/hooks/queries"
import { useUrlFilters } from "@/hooks/use-url-filters"
import { getErrorMessage } from "@/lib/api"
import { rowNo } from "@/lib/utils"
import type { PositionRow } from "@/types"

const COLS = 6
const DEFAULTS: { search?: string; departmentId?: string; status: string } = { search: undefined, departmentId: undefined, status: "all" }
const RULES = { departmentId: /^\d+$/, status: ["all", "active", "inactive"] }

/** HRD: master jabatan; setiap jabatan berada di bawah satu departemen */
export default function PositionsPage() {
  const q = usePositions()
  const depts = useDepartments()
  const save = useSaveOrg("positions")
  const [filters, patch] = useUrlFilters(DEFAULTS, RULES)
  const [editing, setEditing] = useState<{ id?: number; name?: string; departmentId?: number } | null>(null)
  const [deleting, setDeleting] = useState<PositionRow | null>(null)

  const rows = useMemo(() => {
    const s = (filters.search ?? "").toLowerCase()
    return (q.data ?? [])
      .filter((p) => !filters.departmentId || String(p.departmentId) === filters.departmentId)
      .filter((p) => filters.status === "all" || p.isActive === (filters.status === "active"))
      .filter((p) => !s || p.name.toLowerCase().includes(s))
  }, [q.data, filters])

  const toggle = async (p: PositionRow) => {
    try {
      await save.mutateAsync({ id: p.id, data: { isActive: !p.isActive } })
      toast.success(p.isActive ? `${p.name} dinonaktifkan` : `${p.name} diaktifkan kembali`)
    } catch (e) {
      toast.error("Gagal mengubah status", { description: getErrorMessage(e) })
    }
  }

  return (
    <>
      <PageHeader
        title="Jabatan"
        description="Daftar jabatan per departemen. Jabatan nonaktif tidak dapat dipilih untuk karyawan baru."
        actions={
          <Button onClick={() => setEditing({ departmentId: filters.departmentId ? Number(filters.departmentId) : undefined })} disabled={!depts.data?.some((d) => d.isActive)}>
            <IconPlus /> Tambah jabatan
          </Button>
        }
      />
      <Card className="gap-0 overflow-hidden py-0">
        <CardContent className="px-0">
          <div className="flex flex-col gap-2 p-4 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative sm:w-72">
              <IconSearch className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input value={filters.search ?? ""} onChange={(e) => patch({ search: e.target.value || undefined })} placeholder="Cari jabatan…" className="pl-8" />
            </div>
            <Select value={filters.departmentId ?? "all"} onValueChange={(v) => patch({ departmentId: v === "all" ? undefined : v })}>
              <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua departemen</SelectItem>
                {(depts.data ?? []).map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(v) => patch({ status: v })}>
              <SelectTrigger className="sm:w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="inactive">Nonaktif</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="border-t">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="w-12 text-center">No</TableHead>
                  <TableHead>Jabatan</TableHead>
                  <TableHead>Departemen</TableHead>
                  <TableHead className="text-right">Karyawan aktif</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.isLoading ? (
                  <TableSkeletonRows cols={COLS} />
                ) : q.isError ? (
                  <TableMessage cols={COLS} error title="Gagal memuat jabatan" onRetry={() => q.refetch()} />
                ) : rows.length === 0 ? (
                  <TableMessage cols={COLS} title="Jabatan tidak ditemukan" description="Coba ubah filter atau tambahkan jabatan baru." />
                ) : (
                  rows.map((p, i) => (
                    <TableRow key={p.id} className={p.isActive ? undefined : "opacity-60"}>
                      <TableCell className="text-muted-foreground w-12 text-center tabular-nums">{rowNo(i)}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        {p.department}
                        {!p.departmentActive && <span className="text-muted-foreground ml-1.5 text-xs">(departemen nonaktif)</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.employeeCount}</TableCell>
                      <TableCell><ActiveBadge active={p.isActive} /></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Aksi untuk ${p.name}`}><IconDotsVertical /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setEditing({ id: p.id, name: p.name, departmentId: p.departmentId })}><IconPencil /> Ubah nama</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => toggle(p)}>{p.isActive ? <><IconToggleLeft /> Nonaktifkan</> : <><IconToggleRight /> Aktifkan kembali</>}</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(p)}><IconTrash /> Hapus</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <PositionDialog
        key={editing ? `p-${editing.id ?? "new"}-${editing.departmentId ?? ""}` : "closed"}
        target={editing}
        departments={depts.data ?? []}
        onOpenChange={(o) => !o && setEditing(null)}
      />
      <DeleteOrgDialog kind="positions" target={deleting} onOpenChange={(o) => !o && setDeleting(null)} />
    </>
  )
}
