# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Dexa WFH: an attendance app for employees working from home (check-in/check-out with a photo as proof) plus HR monitoring (employee master data, attendance view). It is two independent npm projects, `backend/` and `frontend/`, with no root package.json. UI text, error messages and code comments are in Indonesian; keep new user-facing strings in Indonesian.

## Commands

Backend (`cd backend`, needs local MySQL 8, local Redis (`brew services start redis`), and `.env` copied from `.env.example`):

```bash
npm run db:setup      # runs database/schema.sql + seeds demo accounts (idempotent)
npm run start:dev     # all 5 Nest apps in watch mode via concurrently
npm run build         # nest build for each app, output in dist/apps/<name>/main.js
npm run start:prod
npm test              # Jest unit + e2e tests (no DB/Redis needed)
npm run typecheck     # tsc --noEmit over apps, libs, database and test
npx nest start auth-service --watch   # run one app alone
```

Frontend (`cd frontend`, `.env` holds `VITE_API_URL`, default `http://localhost:3000`):

```bash
npm run dev           # Vite on :5173
npm run build         # tsc -b && vite build
npm run lint          # oxlint (.oxlintrc.json)
npm test              # Vitest (jsdom)
npx shadcn@latest add <component>   # components.json is configured
```

Tests: `npm test` in `backend/` (Jest; `*.spec.ts` next to the code, `test/gateway.e2e-spec.ts` boots the real gateway `AppModule` with fake TCP clients and Redis) and in `frontend/` (Vitest + Testing Library, `*.test.ts(x)` in `src/`). Neither needs MySQL or Redis: `backend/test/helpers.ts` has `memRepo` (in-memory TypeORM repository), `fakeClient` (ClientProxy whose handlers may throw `{ statusCode, message }`), `FakeRedis`, `fakeQb`, `rpcErrorOf`, and `setNow('YYYY-MM-DD HH:mm')` to freeze `Date` in Asia/Jakarta. Run one file with `npx jest <path>` / `npx vitest run <path>`. `docs/api.http` has ready-made requests (VS Code REST Client). `GET /api/health` reports TCP reachability of each microservice.

Demo accounts: `hr@dexa.local` / `Admin123!` (HR_ADMIN), `budi@dexa.local` and `rina@dexa.local` / `Karyawan123!` (EMPLOYEE).

## Backend architecture

NestJS monorepo (`nest-cli.json`, `monorepo: true`, webpack build). Five apps under `apps/` plus one shared library `libs/common`, imported as `@app/common`.

- `api-gateway` (HTTP :3000) is the only HTTP entry point. It owns CORS, the global prefix `/api`, Zod validation, Multer photo upload, auth, the Redis-backed login limiter (`auth/login-limiter.ts`), and CSV formatting (`common/csv.ts`). It holds no DB connection: every controller forwards to a microservice with `sendRpc(client, PATTERNS.X.Y, payload)`.
- `auth-service` (TCP :4001, `users` table), `employee-service` (TCP :4002, `employees`), `attendance-service` (TCP :4003, `attendances`, `attendance_corrections`, `holidays`), `leave-service` (TCP :4004, `leave_requests`). Each registers only its own entity via `DatabaseModule.forRoot([Entity])`. All services share one MySQL DB, but table ownership is kept in code: a service reads another service's data only over TCP (for example, attendance asks employee-service for names, employee-service asks auth-service for user accounts).

Request flow and conventions that span several files:

- **Auth**: `AuthGuard` is a global `APP_GUARD` in the gateway. Every route needs a Bearer token unless decorated `@Public()`. The guard verifies the token by calling `auth.verify` over TCP (not locally), puts the result on `req.user`, then checks `@Roles(Role.HR_ADMIN)`. Use `@CurrentUser()` to read the user.
- **Adding an endpoint**: add the pattern string to `PATTERNS` in `libs/common/src/constants.ts`, add a Zod schema + inferred type in `libs/common/src/schemas/`, add a `@MessagePattern` handler in the owning service's controller, then add a gateway controller method using `new ZodValidationPipe(schema)` on `@Body`/`@Query`/`@Param` and `sendRpc`.
- **Errors across TCP**: inside a microservice, throw with `rpcError(status, message)`. `AllRpcExceptionsFilter` (installed by `bootstrapTcpService`) turns every error into `{ statusCode, message }` and maps MySQL `ER_DUP_ENTRY` to 409. On the gateway side, `sendRpc` turns that back into an `HttpException` with the same status; timeout (8 s) or `ECONNREFUSED` becomes 503. Validation errors have the shape `{ statusCode: 400, message: 'Validasi gagal', errors: { field: msg } }`, which the frontend reads per field.
- **Cross-service write with compensation**: creating an employee first creates the login account in auth-service, then deletes it again with `auth.delete_user` if saving the profile fails (`employee.service.ts`). Follow the same pattern for other multi-service writes.
- **Soft delete**: `DELETE /employees/:id` sends `employee.update` with `isActive: false`. Rows are never removed, so attendance history stays.
- **Schema**: TypeORM `synchronize: false`. The schema lives in `database/schema.sql`; change it there and in the entity together. `DATE` columns come back as strings (`dateStrings: ['DATE']`).
- **Time**: services set `TZ=Asia/Jakarta`, and attendance timestamps come from the server clock. Rules in attendance-service: at most one record per type per day (unique key `employee_id, attendance_date, type`), check-out only after check-in, late = after `WORK_START_TIME`, and both check-in and check-out are rejected after `CHECK_OUT_MAX_TIME` (default 22:00), so a day never spans midnight. `GET /attendance/today` returns `closed` so the UI can lock the form.
- **Server date is the source of truth**: the frontend reads "today" from API responses (`summary.date`, `today.date`), never from the browser clock.
- Monitoring search (`GET /attendance?search=`) resolves matching employee ids through `employee.search_ids` (no row cap), then filters attendances.
- Photos are saved to `uploads/attendance/YYYY-MM/<uuid>.<ext>`. The DB stores the path relative to `uploads/`. There is no public static route: `GET /api/attendance/:id/photo` checks owner or HR_ADMIN and returns 404 to other users. The frontend fetches it as a blob (`usePhotoBlob`) because `<img src>` cannot send the Bearer token. `photo_path` is NULL for records created by an approved correction.
- **Work calendar**: `CalendarService` (attendance-service) owns `WORK_START_TIME`, `CHECK_OUT_MAX_TIME`, `WORK_DAYS` (ISO weekdays, default `1,2,3,4,5`) and the `holidays` table. Summary, recap and `today` use it. Holidays sync from `HOLIDAY_SYNC_URL` (default: guangrei/APIHariLibur_V2 `holidays.json`, Google Calendar based, includes cuti bersama) on startup, every 24 h, and via `POST /holidays/sync`. Rows have `source` MANUAL or SYNC: sync never touches MANUAL rows, updates SYNC names, and deletes SYNC rows missing from the feed for the years the feed covers. Deleting a SYNC row only sets `is_active = 0`, so the next sync does not re-add it; only active rows count as holidays. A Redis lock (`holidays:sync:lock`) lets only one instance sync at a time, and the last result lives in `holidays:sync:last`.
- **Redis** (`RedisModule` in `libs/common`, inject with `@Inject(REDIS)`, `REDIS_URL`) holds only state that must be shared across instances: login-failure counters (`login:fail:email:*`, `login:fail:ip:*`, TTL = `LOGIN_LOCK_MINUTES`) and holiday sync status/lock. The client has no offline queue, so commands fail fast when Redis is down; callers fail open (login works without limiting, sync runs without the lock) instead of erroring. Check-in is still allowed on non-work days; those days are never counted as absent.
- **Requests** (leave in leave-service, corrections in attendance-service) share `RequestStatus` and the review flow: only PENDING can be cancelled (by the owner) or reviewed (by HR). Status changes use a conditional `UPDATE ... WHERE status = 'PENDING'` so concurrent reviews cannot both win. The gateway passes `reviewerOf(user)` so HR cannot review their own request. Approving a correction creates or updates the attendance row in one transaction and sets `correction_id`.
- **Recap** (`attendance.recap`) counts days from `joinDate` up to today (server clock), active employees only. Today counts only once the employee has checked in or is on approved leave. absent = work days with no check-in and no approved leave.
- `database/setup.ts` runs `schema.sql`, then `migrate()` for idempotent ALTERs on old databases (MySQL 8 has no `ADD COLUMN IF NOT EXISTS`). Add new column changes there too.

## Frontend architecture

React 19 + Vite + Tailwind v4 + shadcn/ui. Colors come only from the CSS tokens in `src/index.css`, which use the Dexa Group palette (primary `#A52823`); use token classes (`bg-primary`, `text-warning`), not raw Tailwind colors. (`src/components/ui` is generated shadcn code; `src/components/blocks` comes from the `login-04` and `dashboard-01` blocks). The `@/` alias maps to `src/`.

- **Routing** (`App.tsx`): `createBrowserRouter` with lazy page loading. `RequireAuth` (in `layouts/app-layout.tsx`) guards routes, and a nested `RequireAuth role="HR_ADMIN"` guards `dashboard`, `karyawan`, `monitoring`, `rekap`, `persetujuan` and `hari-libur`. `pengajuan` accepts `?tab=koreksi&date=&type=` to open a prefilled correction form. The route `handle.title` feeds the header. `homePath(role)` picks the landing page after login.
- **API**: `lib/api.ts` holds the axios instance (`${VITE_API_URL}/api`). It attaches the token from `localStorage["dexa.token"]` and calls the `AuthProvider` logout handler on any 401 except login. Use `getErrorMessage` / `getFieldErrors` to show backend errors, `PhotoThumb` for proof photos, and `downloadFile(url, params, name)` for CSV exports (it converts blob error bodies back to JSON).
- **Server state**: all queries and mutations live in `hooks/queries.ts` (TanStack Query). Query keys are grouped by `["employees", ...]`, `["attendance", ...]`, `["holidays", ...]` and `["requests", kind, scope, ...]`, and mutations invalidate by prefix (request and holiday mutations also invalidate `["attendance"]`). `clean()` strips empty and `"all"` filter values before sending params.
- **Validation is duplicated**: `src/lib/schemas.ts` mirrors `backend/libs/common/src/schemas`, and `src/types.ts` mirrors backend response shapes. When a field or rule changes, update both sides.
- **Filters live in the URL**: every list filter, search box, pagination value, month/year picker and tab is a query param (`useUrlFilters(defaults, rules)` + `useSearchInput` in `hooks/use-url-filters.ts`), so a refresh or a shared link restores the view. `defaults` must list every key and be stable (module constant or `useMemo`); values equal to the default are left out of the URL; invalid values (bad numbers, outside `rules`) fall back to the default. Writes use `replace`, so typing does not fill the history. Other params on the page (like `tab`) are kept.
- Forms use React Hook Form + Zod through the `FormField` wrapper (`components/form-field.tsx`).
