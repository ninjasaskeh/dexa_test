import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api"
import type { HolidayValues } from "@/lib/schemas"
import type {
  Attendance, AttendanceSummary, AttendanceType, CorrectionRequest, Department, Employee, PositionRow, EmployeeStats, HolidayList, LeaveRequest,
  Holiday, HolidaySyncResult, MonthlyRecap, Paginated, RequestStatus, TodayAttendance,
} from "@/types"

const clean = (o: object) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "" && v !== undefined && v !== null && v !== "all"))

/* ---------- Karyawan (HRD) ---------- */
export interface EmployeeFilters { page: number; limit: number; search?: string; departmentId?: string; status?: string }

export const useEmployees = (f: EmployeeFilters) =>
  useQuery({
    queryKey: ["employees", f],
    queryFn: async () => (await api.get<Paginated<Employee>>("/employees", { params: clean(f) })).data,
    placeholderData: keepPreviousData,
  })

export const useEmployeeStats = () =>
  useQuery({ queryKey: ["employees", "stats"], queryFn: async () => (await api.get<EmployeeStats>("/employees/stats")).data })

export function useSaveEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data }: { id?: number; data: Record<string, unknown> }) =>
      id ? (await api.patch<Employee>(`/employees/${id}`, data)).data : (await api.post<Employee>("/employees", data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  })
}

export function useToggleEmployee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) =>
      (await api.patch<Employee>(`/employees/${id}`, { isActive })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  })
}

/* ---------- Departemen & jabatan (HRD) ---------- */
export const useDepartments = () =>
  useQuery({ queryKey: ["departments"], queryFn: async () => (await api.get<Department[]>("/departments")).data })

export const usePositions = () =>
  useQuery({ queryKey: ["positions"], queryFn: async () => (await api.get<PositionRow[]>("/positions")).data })

/** Perubahan departemen/jabatan ikut memengaruhi daftar karyawan (nama departemen/jabatan) */
function useInvalidateOrg() {
  const qc = useQueryClient()
  return () =>
    Promise.all(["departments", "positions", "employees"].map((k) => qc.invalidateQueries({ queryKey: [k] })))
}

type OrgKind = "departments" | "positions"

/** Tambah (tanpa id) atau ubah (dengan id) departemen / jabatan */
export function useSaveOrg(kind: OrgKind) {
  const invalidate = useInvalidateOrg()
  return useMutation({
    mutationFn: async ({ id, data }: { id?: number; data: Record<string, unknown> }) =>
      (id ? await api.patch(`/${kind}/${id}`, data) : await api.post(`/${kind}`, data)).data,
    onSuccess: invalidate,
  })
}

export function useDeleteOrg(kind: OrgKind) {
  const invalidate = useInvalidateOrg()
  return useMutation({
    mutationFn: async (id: number) => (await api.delete(`/${kind}/${id}`)).data,
    onSuccess: invalidate,
  })
}

/* ---------- Absensi ---------- */
export interface AttendanceFilters { page: number; limit: number; from?: string; to?: string; type?: string; search?: string }

/** Tambahkan selisih jam server agar jam di UI mengikuti server */
const withClock = <T extends { now: string }>(data: T) => ({ ...data, clockOffset: Date.parse(data.now) - Date.now() })

export const useTodayAttendance = () =>
  useQuery({
    queryKey: ["attendance", "today"],
    queryFn: async () => withClock((await api.get<Omit<TodayAttendance, "clockOffset">>("/attendance/today")).data),
    refetchInterval: 60_000,
  })

export const useMyAttendance = (f: AttendanceFilters, opts?: { enabled?: boolean }) =>
  useQuery({
    enabled: opts?.enabled ?? true,
    queryKey: ["attendance", "me", f],
    queryFn: async () => (await api.get<Paginated<Attendance>>("/attendance/me", { params: clean(f) })).data,
    placeholderData: keepPreviousData,
  })

export const useAllAttendance = (f: AttendanceFilters, opts?: { enabled?: boolean }) =>
  useQuery({
    enabled: opts?.enabled ?? true,
    queryKey: ["attendance", "all", f],
    queryFn: async () => (await api.get<Paginated<Attendance>>("/attendance", { params: clean(f) })).data,
    placeholderData: keepPreviousData,
  })

export const useAttendanceSummary = () =>
  useQuery({
    queryKey: ["attendance", "summary"],
    queryFn: async () => withClock((await api.get<Omit<AttendanceSummary, "clockOffset">>("/attendance/summary")).data),
    refetchInterval: 60_000,
  })

export function useSubmitAttendance() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { type: AttendanceType; photo: File; notes?: string }) => {
      const form = new FormData()
      form.append("type", v.type)
      form.append("photo", v.photo)
      if (v.notes) form.append("notes", v.notes)
      return (await api.post<Attendance>("/attendance", form)).data
    },
    // gagal pun tetap refresh: status hari ini bisa sudah berubah (mis. sudah check-in di tab lain)
    onSettled: () => qc.invalidateQueries({ queryKey: ["attendance"] }),
  })
}

/** Foto bukti diambil lewat axios (butuh token), bukan <img src> langsung */
export const usePhotoBlob = (attendanceId: number, enabled = true) =>
  useQuery({
    queryKey: ["attendance", "photo", attendanceId],
    queryFn: async () => (await api.get<Blob>(`/attendance/${attendanceId}/photo`, { responseType: "blob" })).data,
    enabled,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    retry: false,
  })

/** Rekap bulanan; month kosong = bulan berjalan menurut server */
export const useMonthlyRecap = (month?: string) =>
  useQuery({
    queryKey: ["attendance", "recap", month ?? "current"],
    queryFn: async () => (await api.get<MonthlyRecap>("/attendance/recap", { params: clean({ month }) })).data,
    placeholderData: keepPreviousData,
  })

/* ---------- Hari libur ---------- */
export const useHolidays = (year?: number) =>
  useQuery({
    queryKey: ["holidays", year ?? "current"],
    queryFn: async () => (await api.get<HolidayList>("/holidays", { params: clean({ year }) })).data,
    placeholderData: keepPreviousData,
  })

/** Hari libur memengaruhi rekap & dashboard, jadi data absensi ikut di-refresh */
function useInvalidateCalendar() {
  const qc = useQueryClient()
  return () => Promise.all([qc.invalidateQueries({ queryKey: ["holidays"] }), qc.invalidateQueries({ queryKey: ["attendance"] })])
}

export function useCreateHoliday() {
  const invalidate = useInvalidateCalendar()
  return useMutation({
    mutationFn: async (data: HolidayValues) => (await api.post<Holiday>("/holidays", data)).data,
    onSuccess: invalidate,
  })
}

/** Libur manual dihapus, libur hasil sinkron disembunyikan */
export function useDeleteHoliday() {
  const invalidate = useInvalidateCalendar()
  return useMutation({
    mutationFn: async (id: number) => (await api.delete<{ deleted: boolean; hidden: boolean }>(`/holidays/${id}`)).data,
    onSuccess: invalidate,
  })
}

export function useRestoreHoliday() {
  const invalidate = useInvalidateCalendar()
  return useMutation({
    mutationFn: async (id: number) => (await api.patch(`/holidays/${id}`, { isActive: true })).data,
    onSuccess: invalidate,
  })
}

export function useSyncHolidays() {
  const invalidate = useInvalidateCalendar()
  return useMutation({
    mutationFn: async () => (await api.post<HolidaySyncResult>("/holidays/sync")).data,
    onSettled: invalidate,
  })
}

/* ---------- Pengajuan: cuti/izin/sakit & koreksi absen ---------- */
export type RequestKind = "leave" | "corrections"
export interface RequestFilters { page: number; limit: number; status?: RequestStatus | "all"; search?: string }
type RequestOf<K extends RequestKind> = K extends "leave" ? LeaveRequest : CorrectionRequest

/** scope "me" = pengajuan sendiri, "all" = semua (HRD) */
export const useRequests = <K extends RequestKind>(kind: K, scope: "me" | "all", f: RequestFilters) =>
  useQuery({
    queryKey: ["requests", kind, scope, f],
    queryFn: async () => (await api.get<Paginated<RequestOf<K>>>(scope === "me" ? `/${kind}/me` : `/${kind}`, { params: clean(f) })).data,
    placeholderData: keepPreviousData,
  })

/** Jumlah pengajuan yang menunggu persetujuan (HRD) */
export const usePendingCount = (kind: RequestKind, enabled = true) =>
  useQuery({
    queryKey: ["requests", kind, "all", "pending-count"],
    queryFn: async () => (await api.get<Paginated<unknown>>(`/${kind}`, { params: { status: "PENDING", limit: 1 } })).data.meta.total,
    enabled,
    refetchInterval: 60_000,
  })

/** Pengajuan & keputusan HRD bisa mengubah absensi, rekap, dan status hari ini */
function useInvalidateRequests() {
  const qc = useQueryClient()
  return () => Promise.all([qc.invalidateQueries({ queryKey: ["requests"] }), qc.invalidateQueries({ queryKey: ["attendance"] })])
}

export function useCreateRequest<K extends RequestKind>(kind: K) {
  const invalidate = useInvalidateRequests()
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => (await api.post<RequestOf<K>>(`/${kind}`, data)).data,
    onSuccess: invalidate,
  })
}

export function useCancelRequest(kind: RequestKind) {
  const invalidate = useInvalidateRequests()
  return useMutation({
    mutationFn: async (id: number) => (await api.patch(`/${kind}/${id}/cancel`)).data,
    onSuccess: invalidate,
  })
}

export function useReviewRequest(kind: RequestKind) {
  const invalidate = useInvalidateRequests()
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number; status: "APPROVED" | "REJECTED"; note?: string }) =>
      (await api.patch(`/${kind}/${id}/review`, data)).data,
    onSuccess: invalidate,
  })
}
