# Mobile source structure

The mobile app is being migrated in phases toward a provider-independent architecture.

## Structure

- `app/` — application composition and screen entry points.
- `components/` — reusable UI components.
- `config/` — runtime and environment configuration.
- `database/` — local SQLite schema and migrations.
- `hooks/` — reusable React hooks.
- `lib/` — current shared client helpers kept compatible during migration.
- `services/` — authentication, cloud-data, API, and synchronization services.
- `theme.tsx` — shared visual theme.

Phase 1 only relocates the existing implementation. Behavior remains on the current Supabase + Express stack so the working APK remains the baseline while later phases introduce Google/Firebase and local sync.
