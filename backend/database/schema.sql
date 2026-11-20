-- =============================================================
--  Dexa WFH Attendance - skema database MySQL
--  Tiap microservice "memiliki" tabelnya sendiri:
--    auth-service       -> users
--    employee-service   -> employees
--    attendance-service -> attendances, attendance_corrections, holidays
--    leave-service      -> leave_requests
-- =============================================================

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('HR_ADMIN','EMPLOYEE') NOT NULL DEFAULT 'EMPLOYEE',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at DATETIME     NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS employees (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id        INT UNSIGNED NOT NULL,
  employee_code  VARCHAR(20)  NOT NULL,
  full_name      VARCHAR(120) NOT NULL,
  position       VARCHAR(80)  NOT NULL,
  department     VARCHAR(80)  NOT NULL,
  phone          VARCHAR(20)  NULL,
  join_date      DATE         NOT NULL,
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_employees_user (user_id),
  UNIQUE KEY uq_employees_code (employee_code),
  KEY idx_employees_department (department),
  CONSTRAINT fk_employees_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attendances (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id      INT UNSIGNED NOT NULL,
  type             ENUM('CHECK_IN','CHECK_OUT') NOT NULL,
  attendance_date  DATE         NOT NULL,
  recorded_at      DATETIME     NOT NULL,
  -- NULL bila absen dibuat dari koreksi yang disetujui HRD
  photo_path       VARCHAR(255) NULL,
  notes            VARCHAR(255) NULL,
  -- terisi bila jam absen ini berasal dari koreksi (attendance_corrections.id)
  correction_id    INT UNSIGNED NULL,
  created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attendance_per_day (employee_id, attendance_date, type),
  KEY idx_attendance_date (attendance_date),
  CONSTRAINT fk_attendances_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Hari libur perusahaan / nasional (di luar hari kerja mingguan WORK_DAYS).
-- SYNC = diambil otomatis dari HOLIDAY_SYNC_URL, MANUAL = ditambah HRD (tidak pernah ditimpa sinkronisasi).
-- Baris SYNC tidak dihapus, hanya disembunyikan (is_active = 0) agar tidak muncul lagi saat sinkron berikutnya.
CREATE TABLE IF NOT EXISTS holidays (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  holiday_date  DATE         NOT NULL,
  name          VARCHAR(120) NOT NULL,
  source        ENUM('MANUAL','SYNC') NOT NULL DEFAULT 'MANUAL',
  is_active     TINYINT(1)   NOT NULL DEFAULT 1,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_holidays_date (holiday_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pengajuan koreksi jam absen (lupa check-in / check-out). Baris ini sekaligus jejak audit:
-- jam lama (original_recorded_at), jam baru (requested_time), siapa & kapan disetujui.
CREATE TABLE IF NOT EXISTS attendance_corrections (
  id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id           INT UNSIGNED NOT NULL,
  attendance_date       DATE         NOT NULL,
  type                  ENUM('CHECK_IN','CHECK_OUT') NOT NULL,
  requested_time        TIME         NOT NULL,
  original_recorded_at  DATETIME     NULL,
  reason                VARCHAR(255) NOT NULL,
  status                ENUM('PENDING','APPROVED','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  reviewed_by           INT UNSIGNED NULL,
  reviewed_at           DATETIME     NULL,
  review_note           VARCHAR(255) NULL,
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_corrections_employee (employee_id, attendance_date),
  KEY idx_corrections_status (status),
  CONSTRAINT fk_corrections_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pengajuan cuti / izin / sakit
CREATE TABLE IF NOT EXISTS leave_requests (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id  INT UNSIGNED NOT NULL,
  type         ENUM('CUTI','IZIN','SAKIT') NOT NULL,
  start_date   DATE         NOT NULL,
  end_date     DATE         NOT NULL,
  reason       VARCHAR(255) NOT NULL,
  status       ENUM('PENDING','APPROVED','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  reviewed_by  INT UNSIGNED NULL,
  reviewed_at  DATETIME     NULL,
  review_note  VARCHAR(255) NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_leave_employee (employee_id, start_date),
  KEY idx_leave_range (status, start_date, end_date),
  CONSTRAINT fk_leave_employee FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
