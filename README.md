# DLMSF Monitoring App

This repository is a monorepo containing the DLMSF web application, mobile application, and shared API.

## Repository layout

```text
.
├── frontend/          # Next.js web application
├── mobile/            # Expo + React Native mobile application
├── backend/           # Express + TypeScript API
├── supabase/          # Database migrations and SQL functions
├── .github/           # CI workflows
└── package.json       # Root development/build scripts
```

Keep application-specific source code inside its respective folder. Do not add duplicate `app/`, `components/`, or `lib/` directories at the repository root.

## Requirements

- Node.js 22 or later
- npm

## Install

```sh
npm install
npm --prefix frontend install
npm --prefix backend ci
npm --prefix mobile install
```

## Run applications

Run the web frontend and API together:

```sh
npm run dev
```

- Frontend: http://localhost:3000
- Backend health endpoint: http://localhost:4000/api/health

Run an individual application:

```sh
npm run dev:frontend
npm run dev:backend
npm run dev:mobile
```

The mobile application uses Expo. To launch it on Android or iOS, use the Expo CLI prompts or run `npm --prefix mobile run android` / `npm --prefix mobile run ios`.

## Build

```sh
npm run build
```

The root build currently builds the existing web frontend and backend. Mobile builds are managed separately through Expo and EAS; see [mobile/README.md](mobile/README.md).

## Environment variables

Copy `frontend/.env.example` to `frontend/.env.local` and fill in the Supabase and API values. Run `npm --prefix frontend install` after dependency updates to refresh the frontend lockfile.

Copy `backend/.env-example` to `backend/.env` and fill in the Supabase values.

Never commit real environment files, credentials, or Supabase service-role keys.

## Current DLMSF Workflows

### Loan workflow

- Members can submit loan requests from the member side.
- Administrators review each request and choose **Approved** or **Rejected**.
- Loan audit status uses **Approved/Rejected** for request-review events.
- Standard review remarks are generated as:
  - `Approved loan request for Member 1`
  - `Rejected loan request for Member 1`
- Administrators can still create a loan directly for administrative/manual cases.

### Payments

- Weekly sinking fund due is **PHP 50.00 per head**.
- Administrators can record full or partial weekly contributions per member.
- The admin Payments page is a single **Admin Payments** view. It combines weekly contribution management (individual recording, member payment status, collection-week selection, and bulk generation) with the loan repayment submissions table.
- The collection-week control contains the bulk **Generate weekly payment for all members** action.
- Bulk generation records each member's remaining weekly due for the selected Sunday and avoids duplicating amounts already recorded.
- Each generated weekly payment receives the standardized audit remark:
  `Member 12 paid weekly dues of PHP 300.`

### Loan payments

- Members can submit loan repayments for administrator confirmation.
- Confirmed loan payment audit remarks use:
  `Member 12 made a loan payment of PHP 15,000.`

### Audit

The Audit page combines loan audit records, member loan-request workflow events, payment audit records, and payment-submission workflow events so financial and approval actions remain traceable.

See `frontend/README.md` for the detailed current system behavior, business rules, and workflow documentation.

## Deployment

Deploy the frontend and backend as separate Vercel projects:

- Frontend project root: `frontend`
- Backend project root: `backend`

The mobile application is built and distributed separately using Expo Application Services (EAS). See [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md) and [mobile/README.md](mobile/README.md) for deployment guidance.
