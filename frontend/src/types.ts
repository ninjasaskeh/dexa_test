export type Role = "HR_ADMIN" | "EMPLOYEE"
export type AttendanceType = "CHECK_IN" | "CHECK_OUT"
export type LeaveType = "CUTI" | "IZIN" | "SAKIT"
export type RequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED"

export interface Employee {
  id: number
  userId: number
  employeeCode: string
  fullName: string
  position: string
  department: string
  phone: string | null
  joinDate: string
  isActive: boolean
  email?: string | null
  role?: Role | null
  lastLoginAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface CurrentUser {
  id: number
  email: string
  role: Role
  employee: Employee | null
}

export interface Attendance {
  id: number
  employeeId: number
  type: AttendanceType
  attendanceDate: string
  recordedAt: string
  /** null bila absen dibuat dari koreksi yang disetujui HRD */
  photoPath: string | null
  notes: string | null
  /** terisi bila jam absen ini hasil koreksi */
  correctionId: number | null
  isLate: boolean
  employee?: Pick<Employee, "id" | "employeeCode" | "fullName" | "department" | "position"> | null
}

export interface Paginated<T> {
  data: T[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

/** Ditambahkan di queryFn: selisih jam server - jam perangkat (ms) */
interface ServerClock {
  now: string
  clockOffset: number
}

export interface TodayAttendance extends ServerClock {
  date: string
  workStartTime: string
  /** Batas akhir absen harian (jam server) */
  checkOutMaxTime: string
  /** true bila jam server sudah lewat checkOutMaxTime */
  closed: boolean
  isWorkDay: boolean
  holidayName: string | null
  /** cuti/izin/sakit yang disetujui untuk hari ini */
  leave: { id: number; type: LeaveType; startDate: string; endDate: string } | null
  checkIn: Attendance | null
  checkOut: Attendance | null
}

export type EmployeeLite = Pick<Employee, "id" | "employeeCode" | "fullName" | "department" | "position">

export interface AttendanceSummary extends ServerClock {
  date: string
  workStartTime: string
  checkOutMaxTime: string
  isWorkDay: boolean
  holidayName: string | null
  activeEmployees: number
  /** karyawan aktif yang sudah check-in */
  presentToday: number
  onTimeToday: number
  lateToday: number
  /** kosong di luar hari kerja */
  notCheckedIn: EmployeeLite[]
  onLeave: (EmployeeLite & { leaveType: LeaveType })[]
  departments: { department: string; total: number; present: number }[]
  checkedInToday: number
  checkedOutToday: number
  trend: { date: string; isWorkDay: boolean; holidayName: string | null; checkIn: number; checkOut: number; late: number; onTime: number }[]
}

export interface EmployeeStats {
  total: number
  active: number
  inactive: number
  departments: string[]
  byDepartment: { department: string; count: number }[]
}

export interface Holiday {
  id: number
  date: string
  name: string
  /** SYNC = dari sumber online (HOLIDAY_SYNC_URL), MANUAL = ditambah HRD */
  source: "MANUAL" | "SYNC"
  /** false = disembunyikan, tidak dihitung sebagai libur */
  isActive: boolean
}

export interface HolidaySyncResult {
  at: string
  ok: boolean
  added: number
  updated: number
  removed: number
  years: string[]
  message: string | null
}

export interface HolidayList {
  year: number
  /** hari kerja mingguan, 1 = Senin ... 7 = Minggu */
  workDays: number[]
  sync: { enabled: boolean; url: string | null; last: HolidaySyncResult | null }
  data: Holiday[]
}

export interface RecapRow {
  employee: EmployeeLite
  /** hari kerja yang sudah dihitung (hari ini hanya bila sudah check-in / cuti) */
  workDays: number
  present: number
  late: number
  noCheckOut: number
  leave: Record<LeaveType, number>
  absent: number
  /** check-in di hari libur / akhir pekan */
  extraDays: number
  workMinutes: number
}

export interface MonthlyRecap {
  month: string
  from: string
  to: string
  today: string
  workStartTime: string
  workDays: number
  holidays: { date: string; name: string }[]
  data: RecapRow[]
}

interface Reviewable {
  id: number
  employeeId: number
  reason: string
  status: RequestStatus
  reviewedBy: number | null
  reviewedAt: string | null
  reviewNote: string | null
  createdAt: string
  employee?: EmployeeLite | null
}

export interface LeaveRequest extends Reviewable {
  type: LeaveType
  startDate: string
  endDate: string
}

export interface CorrectionRequest extends Reviewable {
  attendanceDate: string
  type: AttendanceType
  /** "HH:mm" */
  requestedTime: string
  originalRecordedAt: string | null
}
