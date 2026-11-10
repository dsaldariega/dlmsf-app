# DLMSF Monitoring App

This repository is a small monorepo containing two separate applications.

## Repository layout

```text
.
├── frontend/          # Next.js web application
├── backend/           # Express + TypeScript API
├── .github/           # CI workflows
├── package.json       # Root scripts for running/building both apps
└── package-lock.json  # Root orchestration dependencies
```

Keep frontend source code inside `frontend/` and backend source code inside `backend/`. Do not add duplicate `app/`, `components/`, or `lib/` directories at the repository root.

## Requirements

- Node.js 22 or later
- npm

## Install

```sh
npm install
npm --prefix frontend install
npm --prefix backend ci
```

## Run both applications

```sh
npm run dev
```

- Frontend: http://localhost:3000
- Backend health endpoint: http://localhost:4000/api/health

You can also run either app independently:

```sh
npm run dev:frontend
npm run dev:backend
```

## Build

```sh
npm run build
```

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
- The Payments page is organized as **Payments → General Payments → Weekly Payment Contributions / Loan Payments** and keeps the two payment tables together.\n- The collection-week control contains the bulk **Generate weekly payment for all members** action.
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

See [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md) for the API deployment configuration.
