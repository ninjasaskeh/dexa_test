export const AUTH_SERVICE = 'AUTH_SERVICE';
export const EMPLOYEE_SERVICE = 'EMPLOYEE_SERVICE';
export const ATTENDANCE_SERVICE = 'ATTENDANCE_SERVICE';
export const LEAVE_SERVICE = 'LEAVE_SERVICE';

export enum Role {
  HR_ADMIN = 'HR_ADMIN',
  EMPLOYEE = 'EMPLOYEE',
}

export enum AttendanceType {
  CHECK_IN = 'CHECK_IN',
  CHECK_OUT = 'CHECK_OUT',
}

export enum LeaveType {
  CUTI = 'CUTI',
  IZIN = 'IZIN',
  SAKIT = 'SAKIT',
}

/** Status pengajuan (cuti/izin/sakit & koreksi absen) */
export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

/** Message pattern TCP antar microservice */
export const PATTERNS = {
  AUTH: {
    LOGIN: 'auth.login',
    VERIFY: 'auth.verify',
    CREATE_USER: 'auth.create_user',
    UPDATE_USER: 'auth.update_user',
    DELETE_USER: 'auth.delete_user',
    CHANGE_PASSWORD: 'auth.change_password',
    FIND_USERS: 'auth.find_users',
  },
  EMPLOYEE: {
    CREATE: 'employee.create',
    FIND_ALL: 'employee.find_all',
    FIND_ONE: 'employee.find_one',
    FIND_BY_USER: 'employee.find_by_user',
    FIND_BY_NIP: 'employee.find_by_nip',
    FIND_BY_IDS: 'employee.find_by_ids',
    SEARCH_IDS: 'employee.search_ids',
    ACTIVE_LITE: 'employee.active_lite',
    UPDATE: 'employee.update',
    STATS: 'employee.stats',
  },
  DEPARTMENT: {
    LIST: 'department.list',
    CREATE: 'department.create',
    UPDATE: 'department.update',
    DELETE: 'department.delete',
  },
  POSITION: {
    LIST: 'position.list',
    CREATE: 'position.create',
    UPDATE: 'position.update',
    DELETE: 'position.delete',
  },
  ATTENDANCE: {
    SUBMIT: 'attendance.submit',
    TODAY: 'attendance.today',
    MY_HISTORY: 'attendance.my_history',
    FIND_ALL: 'attendance.find_all',
    SUMMARY: 'attendance.summary',
    FIND_ONE: 'attendance.find_one',
    EXPORT: 'attendance.export',
    RECAP: 'attendance.recap',
  },
  HOLIDAY: {
    LIST: 'holiday.list',
    CREATE: 'holiday.create',
    DELETE: 'holiday.delete',
    SET_ACTIVE: 'holiday.set_active',
    SYNC: 'holiday.sync',
  },
  CORRECTION: {
    CREATE: 'correction.create',
    MY_LIST: 'correction.my_list',
    FIND_ALL: 'correction.find_all',
    CANCEL: 'correction.cancel',
    REVIEW: 'correction.review',
  },
  LEAVE: {
    CREATE: 'leave.create',
    MY_LIST: 'leave.my_list',
    FIND_ALL: 'leave.find_all',
    CANCEL: 'leave.cancel',
    REVIEW: 'leave.review',
    APPROVED_IN_RANGE: 'leave.approved_in_range',
  },
} as const;
