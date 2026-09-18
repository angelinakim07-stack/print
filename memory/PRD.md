# PRINT PACK INC — Order & Production Management (PRD)

## Original problem statement
Full mobile Order & Production Management System for a corrugated box manufacturer. One app, role-based experiences (Admin, Manager, Employee, Customer, Vendor), app-owned email/password auth, 8-step order entry, approval/correction workflow, production/QC/dispatch/billing stages, follow-ups, in-app notifications, private document storage, reports/exports.

## User choices
- Build everything (delivered in phases)
- App-owned email/password JWT auth
- Admin-assisted password recovery (email later)
- In-app notifications only (push later)
- Navy primary industrial theme

## Architecture
- Frontend: Expo Router (React Native + TS), TanStack Query, expo-secure-store (refresh token), MDI icons, navy theme in src/theme.ts.
- Backend: FastAPI (modular routers) + Motor/MongoDB, bcrypt + PyJWT (15-min access, rotating 30-day refresh, hashed & revocable), GridFS private documents, per-day atomic counters for PPC/REQ/DSP numbering (Asia/Kolkata).
- Auth deployed as integration playbook (JWT). First-admin CLI: backend/create_first_admin.py. Dev seed auto-runs when DB empty.

## Personas
Admin (full), Manager (view-all + granted rights), Employee (own/assigned + granted stage rights), Customer (own requests/orders portal), Vendor (own requests portal).

## Implemented (2026-09-18)
- Auth: login, refresh (tz-safe), logout, rate-limited login/forgot, honest recovery state, /me.
- Users & permissions: admin CRUD, activate/deactivate (revokes sessions), permission toggles, admin reset password, self change-password/profile.
- External requests: create (REQ ref), list (scoped), triage assign/clarify/reject/convert-to-order.
- Orders: 8-step wizard (Sales, Box, Printing, Conversion, Quality, Commercial, Documents, Declaration), draft save, server-side commercial totals, submit validation (missing list), atomic job numbers.
- Approval: approve (checker≠creator, artwork gate, snapshot), send-back (reason+note), revisions (re-approval, immutable approved spec).
- Production/QC/Dispatch/Billing: stage-gated transitions, QC release qty, dispatch qty guards + partial dispatch, invoices, close.
- Follow-ups: buckets, complete (outcome required), reschedule (reason + history).
- Notifications inbox + unread badge; device register/unregister stubs.
- Reports dashboard + typed reports + permission-gated CSV export.
- Private GridFS docs with auth-gated download (Bearer or ?token=).
- Frontend: staff tabs (Dashboard/Orders/New/Follow-ups/More) + portal tabs (Home/Requests/New/Alerts/Profile), order detail with tabbed sections + Actions sheet, users admin, production board, reports, request triage.
- Testing: 34/34 backend pytest pass; frontend role routing verified.

## Backlog / next
- P1: Native push notifications (Firebase google-services.json) — build required.
- P1: Real email password reset (Emergent-managed email) with single-use tokens.
- P1: Native date/time pickers already added; add offline draft queue (SQLite) + sync indicators.
- P2: Job Card PDF export; calendar view for follow-ups; document version history UI.
- P2: Add testIDs to bottom-tab items; migrate deprecated shadow* props to boxShadow.
