# Teacher Class App

A secure, cross-platform teacher workflow app built with Expo + React Native + TypeScript.

This app is designed for fast in-class usage: start a lesson, rate participation, track attendance and late arrivals, grade homework, review statistics, and manage encrypted backups.

## Tech Stack

- Expo SDK 54
- React Native + React Native Web
- Expo Router (file-based routing)
- TypeScript (strict typing)
- React Query (`@tanstack/react-query`) for async/server-like state
- `@nkzw/create-context-hook` for typed app-wide context providers
- AsyncStorage + SecureStore for persisted local state
- Lucide React Native icons

## Core App Features

- PIN-protected app access with onboarding and lock screen
- Teacher profile setup (name, school, subjects)
- Class and student management
- Lesson mode with live participation and homework rating
- Absence and late tracking (including editable late time)
- Statistics dashboard per class/student
- Schedule planner with substitutions and one-time events
- Encrypted backup, restore, import, export (cross-device capable with password/PIN)
- Data export to CSV/XLSX/PDF
- Guided in-app tutorial / feature tour
- Error boundary + startup logging + audit log utilities

## Routing Structure

### Root routes (`app/`)

- `onboarding.tsx` — first-time setup flow
- `lock.tsx` — PIN unlock screen
- `lesson-active.tsx` — active lesson modal flow
- `(tabs)/...` — main authenticated app area

### Main tabs (`app/(tabs)/`)

- `(lesson)/index.tsx` — start/resume lesson
- `schedule/index.tsx` — weekly planner + events/substitutions
- `classes/index.tsx` — class list management
- `classes/[classId].tsx` — class detail + student CRUD
- `statistics/index.tsx` — student analytics
- `settings/index.tsx` — profile, security, backup, export, compliance

## State Architecture

The app is split into typed providers:

- `AppProvider` (`context/AppContext.tsx`) — primary app/domain state
- `BackupProvider` (`context/BackupContext.tsx`) — backup lifecycle
- `P2PProvider` (`context/P2PContext.tsx`) — device sync/pairing infrastructure
- `TutorialProvider` (`context/TutorialContext.tsx`) — onboarding tour state

All providers are composed in `app/_layout.tsx` under `QueryClientProvider`.

## Data Model (`types/index.ts`)

Primary entities:

- `TeacherProfile`
- `SchoolClass`, `Student`
- `LessonSession`
- `ParticipationEntry`
- `HomeworkEntry`
- `AbsenceEntry`
- `LateEntry`
- `AppData`

Backup/export/sync types:

- Backup: `BackupMetadata`, `BackupSettings`, `BackupFile`, `ExternalBackupFile`
- Export: `ExportOptions`, `ExportField`, `ExportableStudentStats`
- P2P: `P2PSettings`, `P2PSyncState`, `P2PDevice`, `P2PMessage`, QR/session types

## Functional Feature Breakdown

### 1) Authentication & Security

Implemented in `AppContext` + `lock.tsx` + `onboarding.tsx`:

- PIN setup during onboarding
- Secure PIN hash storage (`expo-secure-store`)
- Encrypted app data at rest
- Auto-lock after inactivity/background timeout
- PIN length support and migration helpers
- Recovery path using latest valid backup

### 2) Onboarding

`onboarding.tsx` flow includes:

- Profile setup
- Subject selection
- PIN creation
- Optional initial restore/import steps
- Completion flag persisted in app data

### 3) Class & Student Management

`classes/index.tsx` and `classes/[classId].tsx`:

- Create/delete classes
- Add/edit/remove students
- Student notes support
- Validation and UI feedback

### 4) Lesson Mode

`(tabs)/(lesson)/index.tsx` + `lesson-active.tsx`:

- Choose class + subject and start lesson
- Resume active lesson
- Participation ratings: `+`, `o`, `-`
- Reason tagging for positive/negative ratings
- Homework statuses: done / late / missing
- Mark students absent for lesson
- Mark students late automatically by minutes since lesson start
- Edit late minutes directly per student
- End lesson with completion safeguards and defaulting behavior
- Progress bars and micro-interactions

### 5) Statistics

`(tabs)/statistics/index.tsx`:

- Class picker (for multiple classes)
- Student search/filter
- Subject filter + category filter (participation/homework/attendance)
- Per-student cards with expandable detailed metrics
- Attendance section includes absence count, late count, avg late minutes

### 6) Schedule Planner

`(tabs)/schedule/index.tsx`:

- Weekly grid (Mon–Fri)
- Swipe navigation between weeks (PanResponder + Animated)
- Add recurring schedule entries
- One-time events and all-day blocks
- Substitutions with hidden/replaced regular lessons
- Time settings: start time, lesson duration, max periods, break positions/durations

### 7) Settings & Tools

`(tabs)/settings/index.tsx`:

- Edit profile fields
- Change PIN
- Trigger lock
- Backup controls (manual + settings + restore)
- Import/export backups by text or file
- Data export (CSV/XLSX/PDF) with filters/field selection
- Audit/compliance-related views
- Tutorial replay
- Sync section can be surfaced from provider state depending on current product configuration

### 8) Backup System

`context/BackupContext.tsx` + `utils/backup.ts`:

- Manual and scheduled encrypted backups
- Backup version metadata + integrity checks
- Restore by backup id + PIN/password
- Cleanup by max backup versions
- Export backup to string/file for transfer between devices
- Import backup from string/file
- Scan/import external backup files
- Backup action logs

### 9) Encryption

`utils/encryption.ts`:

- Device salt generation and retrieval
- Encrypt/decrypt helpers
- Legacy decryption compatibility path
- PIN hashing and verification
- Key cache reset utilities

### 10) Export Engine

`utils/export.ts`:

- Generate analytics dataset from app data
- Export to CSV, XLSX, PDF
- Field-level and date-range filtering
- Subject/class filtering
- Optional protected export payload behavior

### 11) Notifications

`utils/lessonNotification.ts`:

- Permission request helper
- Active lesson notification display/update/dismiss
- Notification category/actions setup
- Notification response listeners

### 12) Tutorial & UX Safety

- `TutorialContext` stores first-time tutorial completion
- `FeatureTour.tsx` overlays guided highlights
- `ErrorBoundary.tsx` prevents full-app crashes
- `DelayedLoader.tsx` + `SkeletonLoader.tsx` improve loading UX

## App Context API (Main Functional Methods)

From `useApp()`:

- Auth/session:
- `authenticate`, `authenticateWithPin`, `lock`
- `completeOnboarding`, `updatePin`, `acceptPrivacy`
- Profile/classes/students:
- `updateProfile`
- `addClass`, `deleteClass`
- `addStudent`, `updateStudent`, `deleteStudent`
- Lesson operations:
- `startSession`, `rateStudent`, `rateHomework`
- `markAbsent`, `markLate`, `endSession`
- Recovery/reset:
- `recoverFromBackup`, `dismissRecovery`, `applyRestoredData`, `resetApp`
- Schedule operations:
- `addScheduleEntry`, `addScheduleEntries`, `updateScheduleEntry`, `deleteScheduleEntry`
- `saveScheduleTimeSettings`
- `addOneTimeEvent`, `deleteOneTimeEvent`
- `addSubstitution`, `deleteSubstitution`
- Utility:
- `getCurrentPin`

## Backup Context API

From `useBackup()`:

- `performManualBackup`
- `performScheduledBackup`
- `checkAndRunScheduledBackup`
- `restoreFromBackup`
- `removeBackup`
- `updateSettings`
- `exportBackup`, `exportBackupAsFile`
- `importBackup`, `importFromExternal`
- `scanExternalBackups`, `getLatestBackup`
- `setCurrentPin`, `setGetPinFunction`

## P2P Context API (Infrastructure)

From `useP2P()`:

- Device pairing/session helpers
- QR validation/connect helpers
- Sync request and sync data handlers
- Unpair/disconnect/update settings operations

Note: depending on current UI configuration, some sync controls may be hidden or marked as not currently available.

## Utilities Overview

- `utils/backup.ts` — backup creation, restore, integrity, import/export, file handling
- `utils/encryption.ts` — cryptographic helpers
- `utils/export.ts` — export file generation and preview
- `utils/p2p.ts` — pairing, secure message envelope, vector clocks, merge logic, QR/session data
- `utils/auditLog.ts` — compliance-style event log persistence/formatting
- `utils/lessonNotification.ts` — lesson notification workflows
- `utils/startupLogger.ts` — startup module lifecycle logging

## Components Overview

- `ErrorBoundary.tsx` — catches UI tree errors
- `FeatureTour.tsx` — guided highlight overlays/tutorial
- `DelayedLoader.tsx` — delayed loaders to prevent flicker and show in-progress states
- `SkeletonLoader.tsx` — screen skeletons for loading phases
- `QRCodeDisplay.tsx` — QR rendering utility component

## Storage Keys (High Level)

Persistent keys cover:

- Encrypted app data payload
- PIN hash + metadata
- Privacy/tutorial flags
- Schedule entries/settings/events/substitutions
- Backup metadata/files/logs/settings
- P2P settings, pairings, vector clocks

## Running the Project

```bash
bun install
bun run start
