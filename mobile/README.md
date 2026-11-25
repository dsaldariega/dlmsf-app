# DLMSF Mobile

Expo + React Native client for the existing DLMSF application.

## Requirements

- Node.js 22.13 or newer
- Android 10+ (API 29+) or iOS 16.4+
- Access to the existing DLMSF Supabase project and Express API

## Setup

From the repository root:

```bash
cd mobile
npm install
```

Create `mobile/.env` using `.env.example` and provide:

- `EXPO_PUBLIC_SUPABASE_URL`: the existing DLMSF Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: the existing Supabase anon/public key
- `EXPO_PUBLIC_API_URL`: the existing Express API base URL (currently `https://dlmsf-api.vercel.app`)

Only public client credentials belong in this file. Never add the Supabase service-role key to the mobile app.

## Run

```bash
npm start
npm run android
npm run ios
npm run typecheck
```

## Authentication architecture

- Members sign in with their existing email and password through Supabase Auth.
- The app resolves the account role from `public.members.roles`, linked by `auth_id`, matching the web application's source of truth.
- Supabase sessions are persisted with Expo SecureStore. Values are chunked to avoid the per-item size limits some iOS versions impose.
- Token refresh is enabled while the app is active.
- API requests use the current Supabase access token in the `Authorization: Bearer` header.
- The Express API remains responsible for authorization and all privileged business operations.

The current mobile milestone provides sign-in, session restoration, role verification, sign-out, and a reusable API client. Dashboard and feature screens will be added in later milestones.


## Current mobile experience

The mobile client now includes role-aware navigation and the core DLMSF workflows:

- **Member:** dashboard, active loan and loan request history, loan payment submissions, confirmed payment history, account/sign-out.
- **Admin:** dashboard metrics, loan/payment request review, member account management, linked-login creation/deletion, account/sign-out.
- Pull-to-refresh is available on data-driven screens.
- Business actions continue through the existing Express API; the mobile app does not use the Supabase service-role key.

### Mobile workflow boundary

The app intentionally keeps sensitive operations behind the existing backend, including loan request review, payment confirmation, member account creation/deletion, and financial calculations. The mobile client is a native presentation/client layer over the existing DLMSF API and Supabase Auth session.


## Fiscal Year and Membership Tiers

The admin mobile workflow now supports FY-based membership classification and yearly controls:

- Create and prepare draft Fiscal Years with custom start/end dates.
- Configure maximum total heads, maximum heads per member, and whether head restrictions are enforced.
- Configure Bronze, Silver, and Gold independently for each FY.
- Enable/disable tiers and loan eligibility.
- Choose contribution-only, multiplier/maximum, or unlimited loan-limit modes.
- Configure contribution multipliers and maximum loan amounts.
- Assign each member a tier and FY-specific head allocation.
- Server-side validation prevents assignments from exceeding FY or tier head limits.
- Loan requests use the active FY tier rules and paid contributions when calculating eligibility.
- Export a selected FY as an XLSX workbook containing yearly summaries, members, tier settings, contributions, payments, loans, loan payments, requests, submissions, and audit records.

The FY configuration is additive to the existing member and transaction tables, so historical transaction records are not rewritten when a member's tier changes in a later FY.


### Fiscal year setup, retention, and archive cleanup

- Admin creates an FY from Settings → Fiscal Year Management.
- Bronze, Silver, and Gold are configured before the draft FY is created. Each tier supports enablement, per-member head cap, loan eligibility, loan-limit mode, contribution multiplier, and optional maximum loan amount.
- FY-wide total-head and per-member limits are configured in the same wizard, followed by a review summary.
- Retention defaults to 3 months after closure and is configurable from 3 to 60 months while the FY remains a draft.
- Member tier/head evaluations are fresh each FY; previous assignments are not carried forward automatically.
- Activation locks FY and tier settings as a historical snapshot.
- Exports are recorded by the API. After the retention period, an administrator can type the exact confirmation phrase to request cleanup. FY/tier/member assignment metadata and loan contracts/repayment history are retained; any ongoing loan blocks cleanup.

## Firebase client foundation

The mobile app includes the Firebase JavaScript SDK, React Native Auth
persistence through AsyncStorage, and a Firestore client factory. Firebase is
not yet the active app provider: the existing Supabase auth and API adapters
remain in use until the later authentication and data migration phases.

`createFirebaseClient(config)` accepts the public Firebase configuration for
a DLMSF instance and caches its Firebase App by project ID. This is deliberate:
the same APK can connect to different Firebase projects at runtime, so a
project-specific `EXPO_PUBLIC_FIREBASE_*` build configuration must not be
mistaken for the identity of every installation. A trusted setup/invitation
flow will supply the correct instance configuration in a later phase.

Firebase client configuration is not a secret. Never ship Firebase Admin SDK
credentials, service-account JSON, or private keys in the mobile app. Access
must be enforced by Firebase Authentication and Firestore Security Rules.