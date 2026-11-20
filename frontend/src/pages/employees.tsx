import { useEffect, useState } from "react"
import { toast } from "sonner"
import { IconDotsVertical, IconPencil, IconPlus, IconSearch, IconUserCheck, IconUserOff } from "@tabler/icons-react"
import { ActiveBadge } from "@/components/attendance-badge"
import { useAuth } from "@/components/auth-provider"
import { DataTablePagination } from "@/components/data-table-pagination"
import { EmployeeCell } from "@/components/employee-cell"
import { EmployeeFormDialog } from "@/components/employee-form-dialog"
import { PageHeader } from "@/components/page-header"
import { TableMessage, TableSkeletonRows } from "@/components/table-state"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useEmployeeStats, useEmployees, useToggleEmployee, type EmployeeFilters } from "@/hooks/queries"
import { useDebounce } from "@/hooks/use-debounce"
import { getErrorMessage } from "@/lib/api"
import { fmtDate, fmtRelative } from "@/lib/format"
import type { Employee } from "@/types"

const COLS = 7

export default function EmployeesPage() {
  const { user } = useAuth()
  const [filters, setFilters] = useState<EmployeeFilters>({ page: 1, limit: 10, status: "all" })
  const [search, setSearch] = useState("")
  const debounced = useDebounce(search)
  useEffect(() => setFilters((f) => ({ ...f, search: debounced || undefined, page: 1 })), [debounced])
  const q = useEmployees(filters)
  const stats = useEmployeeStats()
  const toggle = useToggleEmployee()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [confirm, setConfirm] = useState<Employee | null>(null)
  const departments = stats.data?.departments ?? []
  const patch = (p: Partial<EmployeeFilters>) => setFilters((f) => ({ ...f, ...p }))

  const openForm = (e: Employee | null) => { setEditing(e); setFormOpen(true) }

  const doToggle = async (e: Employee) => {
    try {
      await toggle.mutateAsync({ id: e.id, isActive: !e.isActive })
      toast.success(e.isActive ? `${e.fullName} dinonaktifkan` : `${e.fullName} diaktifkan kembali`)
    } catch (err) {
      toast.error("Gagal mengubah status", { description: getErrorMessage(err) })
    } finally {
      setConfirm(null)
    }
  }

  return (
    <>
      <PageHeader
        title="Data Karyawan"
        description="Kelola data master karyawan dan akun login mereka."
        actions={<Button onClick={() => openForm(null)}><IconPlus /> Tambah karyawan</Button>}
      />
      <Card className="gap-0 overflow-hidden py-0">
        <CardContent className="px-0">
          <div className="flex flex-col gap-2 p-4 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative sm:w-72">
              <IconSearch className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama, kode, jabatan…" className="pl-8" />
            </div>
            <Select value={filters.department ?? "all"} onValueChange={(v) => patch({ department: v === "all" ? undefined : v, page: 1 })}>
              <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua departemen</SelectItem>
                {departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(v) => patch({ status: v, page: 1 })}>
              <SelectTrigger className="sm:w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="inactive">Nonaktif</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border-y">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead>Jabatan</TableHead>
                  <TableHead>Hak akses</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Login terakhir</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.isLoading ? (
                  <TableSkeletonRows cols={COLS} />
                ) : q.isError ? (
                  <TableMessage cols={COLS} error title="Gagal memuat data" onRetry={() => q.refetch()} />
                ) : q.data?.data.length === 0 ? (
                  <TableMessage cols={COLS} title="Karyawan tidak ditemukan" description="Coba kata kunci lain atau tambahkan karyawan baru." action={<Button size="sm" onClick={() => openForm(null)}><IconPlus /> Tambah karyawan</Button>} />
                ) : (
                  q.data?.data.map((e) => (
                    <TableRow key={e.id} className={e.isActive ? undefined : "opacity-60"}>
                      <TableCell><EmployeeCell name={e.fullName} subtitle={e.email ?? undefined} /></TableCell>
                      <TableCell><span className="bg-muted rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums">{e.employeeCode}</span></TableCell>
                      <TableCell>
                        <p className="font-medium">{e.position}</p>
                        <p className="text-muted-foreground text-xs">{e.department} · sejak {fmtDate(e.joinDate)}</p>
                      </TableCell>
                      <TableCell>
                        <span className={e.role === "HR_ADMIN" ? "text-primary text-sm font-medium" : "text-sm"}>{e.role === "HR_ADMIN" ? "Admin HRD" : "Karyawan"}</span>
                      </TableCell>
                      <TableCell><ActiveBadge active={e.isActive} /></TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{e.lastLoginAt ? fmtRelative(e.lastLoginAt) : "Belum pernah"}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Aksi untuk ${e.fullName}`}><IconDotsVertical /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => openForm(e)}><IconPencil /> Ubah data</DropdownMenuItem>
                            {e.userId !== user?.id && <DropdownMenuSeparator />}
                            {e.userId === user?.id ? null : e.isActive ? (
                              <DropdownMenuItem variant="destructive" onSelect={() => setConfirm(e)}><IconUserOff /> Nonaktifkan</DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onSelect={() => doToggle(e)}><IconUserCheck /> Aktifkan kembali</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <DataTablePagination className="px-5 py-3" meta={q.data?.meta} onPageChange={(page) => patch({ page })} onLimitChange={(limit) => patch({ limit, page: 1 })} />
        </CardContent>
      </Card>

      <EmployeeFormDialog open={formOpen} onOpenChange={setFormOpen} employee={editing} departments={departments} />

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nonaktifkan {confirm?.fullName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Karyawan tidak akan bisa login dan melakukan absen. Riwayat absensi tetap tersimpan dan akun bisa diaktifkan kembali kapan saja.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90" onClick={() => confirm && doToggle(confirm)}>Nonaktifkan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
