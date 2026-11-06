<<<<<<< HEAD
# Dili Labad Members Sinking Fund Management System

**DLMSF Management System**

A web-based management and monitoring system designed to help administrators manage members, sinking fund contributions, member loans, loan payments, and financial records.

> 🚧 **Project Status: Under Development**
>
> The Admin Management and Monitoring features are currently being developed. Member-side functionality and additional backend services are still in progress.

---

## 📌 Overview

The **Dili Labad Members Sinking Fund Management System (DLMSF)** is designed to simplify the management of a members' sinking fund.

The system helps the administrator or assigned fund handler monitor:

- Members
- Member heads
- Weekly sinking fund contributions
- Available funds
- Member loans
- Loan repayments
- Monthly collection targets
- Financial audit records

The main goal is to provide a centralized system that makes fund management easier, more organized, and easier to monitor.

---

## 🎯 Objectives

The system aims to:

- Manage sinking fund members.
- Track the number of heads per member.
- Automatically calculate weekly contributions.
- Monitor weekly and monthly sinking fund collections.
- Monitor available funds for member loans.
- Manage member loans.
- Track outstanding loan balances.
- Record loan payments.
- Monitor monthly loan collection targets.
- Maintain loan and payment audit records.

---

## 🛠️ Technology Stack

| Technology | Purpose |
|---|---|
| React.js | Frontend UI |
| Next.js | Web application framework |
| Supabase | Database and backend services |
| Node.js | Planned backend/server-side functionality |

### Current Architecture

```text
React.js
    │
    ▼
Next.js
    │
    ▼
Supabase
    │
    ▼
Database
```

Node.js is planned to be added as the project develops.

---

# ✨ Features

## 📊 Admin Dashboard

The Admin Dashboard provides an overview of the current sinking fund and loan status.

### Dashboard Metrics

- **Total Members**
  - Total number of registered sinking fund members.

- **Total Heads**
  - Combined number of heads owned by all members.

- **Sinking Fund Collected**
  - Total sinking fund contributions collected.

- **Available Funds**
  - Funds currently available for member loans.

- **Total Loan Payments**
  - Total amount collected from loan payments.

- **Outstanding Loan Principal**
  - Remaining principal amount from active member loans.

---

## 💰 Sinking Fund

Each member contributes based on their number of heads.

### Contribution Rate

**₱50 per head per week**

### Formula

```text
Weekly Due = Number of Heads × ₱50
```

Example:

```text
Member has 4 heads

4 × ₱50 = ₱200 weekly contribution
```

Weekly collection is scheduled for **Sunday**.

---

## 📅 Monthly Sinking Fund Collection

The system provides monthly monitoring of sinking fund collections.

The collection monitoring starts from:

**December 2025**

The monthly collection table contains:

| Column | Description |
|---|---|
| Month | Collection month |
| Target | Expected collection |
| Collected | Actual collected amount |
| Status | Indicates whether the target was reached |

---

## 📈 Monthly Loan Collection

The system also monitors monthly loan repayment collections.

The administrator can define the expected monthly collection target.

| Column | Description |
|---|---|
| Month | Collection month |
| Target | Expected loan collection |
| Collected | Actual loan payments collected |
| Status | Pending or Completed |

---

# 👥 Members

The Members Page is used to manage sinking fund members.

### Member Summary

The page displays:

- Total Members
- Total Heads
- Estimated Weekly Collection

### Estimated Weekly Collection

```text
Estimated Weekly Collection
= Total Heads × ₱50
```

### Add Member

The administrator can add:

- Member Name
- Number of Heads

### Member Table

| Column | Description |
|---|---|
| Member | Member name |
| Heads | Number of heads |
| Weekly Due | Heads × ₱50 |

---

# 💵 Loans

The Loans Page manages member loans.

### Loan Dashboard

The page provides:

- Total Loan Principal
- Outstanding Loan Balance
- Ongoing Loans
- Paid Loans

---

## Add Loan

The administrator can create a loan by selecting:

- Borrower
- Loan Amount
- Repayment Duration

### Loan Eligibility

A member must meet the applicable loan requirements.

The system is designed to ensure that:

- The borrower is a registered member.
- Sufficient available funds exist.
- Members with outstanding/pending loans cannot create another loan.

---

## Repayment Duration

The system supports repayment durations from:

**1 to 12 months**

---

# 📋 Loan Terms

The current loan terms are:

| Term | Value |
|---|---|
| Monthly Interest | 5% of original principal |
| Standard Repayment Duration | 2 months |
| Payment Due Date | 15th of every month |
| Late Payment Penalty | 2.5% of original loan amount |

### Interest Formula

```text
Monthly Interest
= Original Principal × 5%
```

Example:

```text
Principal = ₱10,000

₱10,000 × 5%
= ₱500 monthly interest
```

---

# 💳 Payments

The Payments Page manages sinking fund and loan payment records.

### Payment Summary

- Total Loan Payments
- Weekly Payment Records

---

## Generate Weekly Payment

The administrator can generate a weekly sinking fund collection record.

The collection day is restricted to:

**Sunday**

Example:

```text
Week Start: November 1, 2026
```

---

## Weekly Payment Table

| Column | Description |
|---|---|
| Week Start | Sunday collection date |
| Amount | Total expected/recorded collection |

### Amount Calculation

```text
Total Heads × ₱50
```

Example:

```text
Total Heads = 211
Rate = ₱50

211 × ₱50
= ₱10,550
```

---

## Loan Payments Table

| Column | Description |
|---|---|
| Borrower | Member who borrowed the loan |
| Amount | Loan amount |
| Date Paid | Date loan was fully paid |

---

# 🔎 Audit

The Audit Page provides a record of important loan and payment transactions.

It contains:

- Loan Audit
- Payment Audit

The purpose of the audit system is to provide traceability and historical records for financial activities.

---

# 🧾 Loan Audit

The Loan Audit table contains:

| Column | Description |
|---|---|
| Reference ID | Unique system-generated loan ID |
| Borrower | Member who received the loan |
| Principal | Original loan principal |
| Interest | Applicable interest |
| Total | Principal + Interest |
| Monthly | Expected monthly payment |
| Status | Current loan status |
| Remarks | Additional transaction information |
| Created Date | Date audit record was created |

### Loan Reference Format

```text
L-<DDmmYYYY>-000001
```

Example:

```text
L-05112026-000001
```

Subsequent records increment the sequence:

```text
L-05112026-000001
L-05112026-000002
L-05112026-000003
```

### Example Audit Remark

```text
New loan created for member X, payable for 5 months,
created date: 2026-11-05
```

---

# 🧾 Payment Audit

The Payment Audit table records weekly sinking fund collection activities.

| Column | Description |
|---|---|
| Reference ID | Unique payment reference |
| Week | Sunday collection week |
| Amount | Weekly collection amount |
| Remarks | Collection information |

### Payment Reference Format

```text
P-<DDmmYYYY>-000001
```

Example:

```text
P-05112026-000001
```

Subsequent records increment the sequence:

```text
P-05112026-000001
P-05112026-000002
P-05112026-000003
```

### Example Audit Remark

```text
Weekly sinking fund collected/generated for Sunday,
2026-11-01, Total members heads: 211,
Rate per head ₱50
```

---

# 🔄 System Workflow

The general system workflow is:

```text
                         DLMSF SYSTEM
                              │
                              ▼
                       ADMIN DASHBOARD
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
          ▼                   ▼                   ▼
       MEMBERS              LOANS              PAYMENTS
          │                   │                   │
          ▼                   ▼                   ▼
    Member + Heads       Loan Creation       Weekly Collection
          │                   │                   │
          ▼                   ▼                   ▼
    Weekly Due          Repayment Plan       Payment Record
          │                   │                   │
          └───────────────────┼───────────────────┘
                              ▼
                           AUDIT
                              │
                   ┌──────────┴──────────┐
                   ▼                     ▼
               Loan Audit          Payment Audit
```

---

# 📐 Core Business Rules

## Sinking Fund

```text
Rate per Head = ₱50/week

Weekly Due = Number of Heads × ₱50
```

Collection day:

```text
Sunday
```

---

## Loans

- Only registered members can receive loans.
- Loan availability depends on available funds.
- Members with outstanding/pending loans should not receive another loan.
- Repayment duration can be configured from 1–12 months.
- Monthly interest is currently set to 5% of the original principal.
- Payment due date is the 15th of each month.
- Late-payment penalty is currently set to 2.5% of the original loan amount.

---

# 🗂️ Project Structure

The project structure may evolve as development continues.

A typical structure is expected to follow:

```text
DLMSF/
│
├── app/
│   ├── dashboard/
│   ├── members/
│   ├── loans/
│   ├── payments/
│   └── audit/
│
├── components/
│
├── lib/
│
├── public/
│
├── styles/
│
└── README.md
```

> The actual project structure may differ depending on the current implementation.

---

# 🚧 Development Status

The project is currently under active development.

### Currently Implemented / In Development

- [x] Admin Dashboard
- [x] Member Management
- [x] Member Heads
- [x] Weekly Contribution Calculation
- [x] Sinking Fund Monitoring
- [x] Monthly Sinking Fund Collection
- [x] Monthly Loan Collection Monitoring
- [x] Loan Management
- [x] Loan Terms
- [x] Payment Management
- [x] Weekly Payment Generation
- [x] Loan Payment Records
- [x] Loan Audit
- [x] Payment Audit

### In Progress

- [ ] Member Portal
- [ ] Member Dashboard
- [ ] Member Payment History
- [ ] Member Loan History
- [ ] Node.js backend integration
- [ ] Additional validation
- [ ] Additional reports
- [ ] Additional security improvements

---

# 🚀 Future Enhancements

Possible future improvements include:

- Member login and authentication
- Member dashboard
- Member contribution history
- Member loan history
- Automated loan repayment schedules
- Automated late-payment calculations
- Automated penalty calculations
- Financial reports
- PDF/Excel report generation
- Exportable audit records
- Notification system
- Role-based access control
- Improved backend architecture
- Additional data validation
- Enhanced security

---

# 🔐 Security Considerations

As the system continues to develop, security improvements will include:

- Authentication
- Authorization
- Role-based permissions
- Database access control
- Input validation
- Secure API endpoints
- Audit logging
- Protection of member financial information

Supabase security policies should be configured appropriately before the system is deployed for production use.

---

# 📅 Project Timeline

The sinking fund collection records currently begin from:

**December 2025**

The system uses weekly Sunday collections as the primary sinking fund collection period.

---

# 📍 Project Information

**Project Name:**  
Dili Labad Members Sinking Fund Management System

**Abbreviation:**  
DLMSF

**Application:**  
DLMSF Management System

**Status:**  
Under Development

**Frontend:**  
React.js / Next.js

**Backend / Database:**  
Supabase

**Planned Backend:**  
Node.js

---

# 👨‍💻 Development

This project is currently being developed as a custom management solution for the Dili Labad Members Sinking Fund.

The system and its features may continue to change as additional requirements, validation rules, and member-side functionality are implemented.

---

# 📄 License

This project is currently intended for the management and operational use of the Dili Labad Members Sinking Fund.

License terms may be added when the project is finalized.


This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
<<<<<<< HEAD
=======
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
=======


## Monorepo structure and development

The repository contains two separate applications. Keep all application source files inside their respective folders:

```text
.
├── frontend/          # Next.js application (app/, components/, lib/)
├── backend/           # Express + TypeScript API
├── .github/           # CI workflows
├── package.json       # Root development scripts
└── package-lock.json  # Root tooling dependencies
```

Do not create duplicate `app/`, `components/`, or `lib/` folders at the repository root. The Vercel frontend project root is `frontend`; the API project root is `backend`.

For local setup, install the root tools and both applications:
>>>>>>> 71a310415f8d3313954374505d479551c9e77442

```sh
npm install
npm --prefix frontend install
npm --prefix backend ci
<<<<<<< HEAD
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

## Deployment

Deploy the frontend and backend as separate Vercel projects:

- Frontend project root: `frontend`
- Backend project root: `backend`

See [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md) for the API deployment configuration.
>>>>>>> 92e9eddfd3420d4890c9dfe91f756543ddbdd4b3
=======
npm run dev
```

Use `npm --prefix frontend install` after frontend dependency updates so its lockfile is refreshed. Copy `frontend/.env.example` to `frontend/.env.local` and `backend/.env-example` to `backend/.env`; never commit real credentials.

Vercel uses `main` for Production and `dev` for Preview deployments. See [backend/DEPLOYMENT.md](backend/DEPLOYMENT.md) for deployment settings.
>>>>>>> 71a310415f8d3313954374505d479551c9e77442
