import { useMemo, useState } from "react"
import { Link } from "react-router"
import { toast } from "sonner"
import { IconDotsVertical, IconPencil, IconPlus, IconSearch, IconToggleLeft, IconToggleRight, IconTrash } from "@tabler/icons-react"
import { ActiveBadge } from "@/components/attendance-badge"
import { DeleteOrgDialog, DepartmentDialog } from "@/components/organization-dialogs"
import { PageHeader } from "@/components/page-header"
import { TableMessage, TableSkeletonRows } from "@/components/table-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDepartments, useSaveOrg } from "@/hooks/queries"
import { useUrlFilters } from "@/hooks/use-url-filters"
import { getErrorMessage } from "@/lib/api"
import { rowNo } from "@/lib/utils"
import type { Department } from "@/types"

const COLS = 6
const DEFAULTS: { search?: string; status: string } = { search: undefined, status: "all" }
const RULES = { status: ["all", "active", "inactive"] }

/** HRD: master departemen */
export default function DepartmentsPage() {
  const q = useDepartments()
  const save = useSaveOrg("departments")
  const [filters, patch] = useUrlFilters(DEFAULTS, RULES)
  const [editing, setEditing] = useState<{ id?: number; name?: string } | null>(null)
  const [deleting, setDeleting] = useState<Department | null>(null)

  const rows = useMemo(() => {
    const s = (filters.search ?? "").toLowerCase()
    return (q.data ?? [])
      .filter((d) => filters.status === "all" || d.isActive === (filters.status === "active"))
      .filter((d) => !s || d.name.toLowerCase().includes(s))
  }, [q.data, filters])

  const toggle = async (d: Department) => {
    try {
      await save.mutateAsync({ id: d.id, data: { isActive: !d.isActive } })
      toast.success(d.isActive ? `${d.name} dinonaktifkan` : `${d.name} diaktifkan kembali`)
    } catch (e) {
      toast.error("Gagal mengubah status", { description: getErrorMessage(e) })
    }
  }

  return (
    <>
      <PageHeader
        title="Departemen"
        description="Daftar departemen perusahaan. Departemen nonaktif tidak dapat dipilih untuk karyawan baru."
        actions={<Button onClick={() => setEditing({})}><IconPlus /> Tambah departemen</Button>}
      />
      <Card className="gap-0 overflow-hidden py-0">
        <CardContent className="px-0">
          <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
            <div className="relative sm:w-72">
              <IconSearch className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input value={filters.search ?? ""} onChange={(e) => patch({ search: e.target.value || undefined })} placeholder="Cari departemen…" className="pl-8" />
            </div>
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
                  <TableHead>Departemen</TableHead>
                  <TableHead className="text-right">Jabatan</TableHead>
                  <TableHead className="text-right">Karyawan aktif</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.isLoading ? (
                  <TableSkeletonRows cols={COLS} />
                ) : q.isError ? (
                  <TableMessage cols={COLS} error title="Gagal memuat departemen" onRetry={() => q.refetch()} />
                ) : rows.length === 0 ? (
                  <TableMessage cols={COLS} title="Departemen tidak ditemukan" description="Coba kata kunci lain atau tambahkan departemen baru." />
                ) : (
                  rows.map((d, i) => (
                    <TableRow key={d.id} className={d.isActive ? undefined : "opacity-60"}>
                      <TableCell className="text-muted-foreground w-12 text-center tabular-nums">{rowNo(i)}</TableCell>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell className="text-right">
                        <Link to={`/positions?departmentId=${d.id}`} className="text-primary tabular-nums underline-offset-4 hover:underline">
                          {d.positions.length} jabatan
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{d.employeeCount}</TableCell>
                      <TableCell><ActiveBadge active={d.isActive} /></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Aksi untuk ${d.name}`}><IconDotsVertical /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => setEditing({ id: d.id, name: d.name })}><IconPencil /> Ubah nama</DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => toggle(d)}>{d.isActive ? <><IconToggleLeft /> Nonaktifkan</> : <><IconToggleRight /> Aktifkan kembali</>}</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(d)}><IconTrash /> Hapus</DropdownMenuItem>
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

      <DepartmentDialog key={editing ? `d-${editing.id ?? "new"}` : "closed"} target={editing} onOpenChange={(o) => !o && setEditing(null)} />
      <DeleteOrgDialog kind="departments" target={deleting} onOpenChange={(o) => !o && setDeleting(null)} />
    </>
  )
}
