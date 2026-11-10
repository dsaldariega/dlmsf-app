# Dili Labad Members Sinking Fund Management System

**DLMSF Management System**

A web-based management system for administrators and members to manage sinking fund contributions, loans, repayments, and audit records.

## Current System Architecture

The repository is a small monorepo:

```text
.
├── frontend/          # Next.js web application
├── backend/           # Express + TypeScript API
├── supabase/          # Database migrations and SQL functions
└── package.json       # Root development/build scripts
```

The frontend communicates with the Express API, while the API uses Supabase with the authenticated user's access token.

## Requirements

- Node.js 22 or later
- npm
- A configured Supabase project
- Frontend API and Supabase environment variables

Install dependencies:

```sh
npm install
npm --prefix frontend install
npm --prefix backend ci
```

Run the application:

```sh
npm run dev
```

- Frontend: http://localhost:3000
- Backend health endpoint: http://localhost:4000/api/health

Build everything:

```sh
npm run build
```

## Roles and Responsibilities

### Administrator

Administrators can:

- Manage members and member heads.
- Review and approve or reject member loan requests.
- Create a loan directly when an administrative/manual loan entry is required.
- Mark eligible loans as paid.
- Review and confirm loan payment submissions.
- Record weekly contributions for individual members.
- Generate weekly contribution records for all members in one action.
- Review payment and loan audit records.
- Delete supported loan/payment records and their corresponding audit entries.

### Member

Members can:

- View their member information and registered heads.
- Submit a loan request.
- Track loan request status and administrator remarks.
- View their approved/rejected requests and loan records.
- Submit loan repayment records for administrator confirmation.
- View their payment history.

The normal loan workflow is now **member request → administrator review → approved/rejected**. The administrator's direct loan creation capability remains available as an administrative fallback.

## Sinking Fund

The weekly contribution rate is:

**PHP 50.00 per head per week**

Formula:

```text
Weekly Due = Number of Heads × PHP 50.00
```

Collection weeks use **Sunday** as the week-start date.

Example:

```text
Member has 6 heads

6 × PHP 50.00
= PHP 300.00 weekly due
```

## Weekly Payment Management

Administrators can manage member payments from the Payments page. The admin Payments page is a single consolidated **Admin Payments** view. It contains the weekly contribution management workflow (including individual recording, member payment status, collection-week selection, and bulk generation) followed by the loan payments table. The separate weekly contributions screen is no longer rendered alongside Admin Payments.

### Individual recording

An administrator can:

1. Select a Sunday collection week.
2. Select a member.
3. Record a full or partial payment.
4. Enter the payment date.
5. Optionally add a reference/note.

The system prevents recording more than the member's remaining weekly due.

### Bulk weekly payment generation

The weekly contributions section on Admin Payments also provides:

**Generate weekly payment for all members**

This bulk action:

- Uses each member's registered number of heads.
- Calculates each member's weekly due at PHP 50.00 per head.
- Checks any amount already recorded for that Sunday.
- Records only the remaining amount.
- Creates confirmed member payment records and contribution allocations.
- Creates an audit entry for each generated member payment.
- Can therefore be safely run again without duplicating already-paid weekly amounts.

Example:

```text
Member 12
Heads: 6
Weekly due: PHP 300.00
Already recorded: PHP 0.00

Bulk generation records:
PHP 300.00
```

If the member already has PHP 100.00 recorded, the bulk action records only the remaining PHP 200.00.

## Loans

### Member loan request

Members can submit a loan request by specifying:

- Loan amount
- Repayment duration

The request is sent to the administrator for review.

A member cannot create another request while an existing loan is still ongoing or while another request is pending.

### Administrator review

The administrator chooses:

- **Approved**
- **Rejected**

The audit status uses the same values.

The audit remarks are standardized to:

```text
Approved loan request for Member 1
```

or:

```text
Rejected loan request for Member 1
```

The member name is inserted from the member record, so the wording is consistent across audit records.

### Administrator direct loan creation

Administrators can still create a loan directly from the administrative loan management workflow. This is intentionally retained for administrative/manual cases.

The member-request workflow should be used for normal member-initiated borrowing.

## Loan Terms

The current loan calculation rules are:

| Term | Current value |
|---|---|
| Monthly interest | 5% of original principal |
| Supported duration | 1, 2, 3, 4, 5, 6, 9, 12, 18, or 24 months |
| Payment due date | 15th of each month |
| Late payment penalty | 2.5% of original loan amount |

Interest:

```text
Interest = Original Principal × 5% × Number of Months
```

Total repayment:

```text
Total = Principal + Interest
```

Monthly amount:

```text
Monthly = Total ÷ Number of Months
```

## Loan Payments

Members can submit loan repayment records for administrator confirmation.

For a confirmed loan payment, the payment audit remark is standardized to (without trailing decimal places):

```text
Member 12 made a loan payment of PHP 15,000.
```

The member name and amount are taken from the payment submission, so the audit message is generated consistently.

Rejected submissions can retain administrator-provided remarks because the payment was not confirmed as received.

## Payment Audit

Payment audit records include the collection/payment reference, date or week, amount, action, and remarks.

### Weekly payment audit remark

For a confirmed weekly payment (without trailing decimal places):

```text
Member 12 paid weekly dues of PHP 300.
```

### Loan payment audit remark

For a confirmed loan payment:

```text
Member 12 made a loan payment of PHP 15,000.00.
```

Payment audit amounts are displayed without trailing decimal places. For example: `Member 12 paid weekly dues of PHP 300.` and `Member 12 made a loan payment of PHP 15,000.`

## Loan Audit

Loan audit records include:

- Reference ID
- Borrower
- Principal
- Interest
- Total repayment
- Monthly amount
- Status/action
- Remarks
- Created date

Loan request review records use:

```text
Status: Approved
Remarks: Approved loan request for Member 1
```

or:

```text
Status: Rejected
Remarks: Rejected loan request for Member 1
```

## Audit Trail

The Audit page combines:

- Loan audit records
- Member loan-request workflow events
- Payment audit records
- Member payment-submission workflow events

The audit trail is intended to make financial and approval actions traceable.

## System Workflow

```text
                    DLMSF SYSTEM
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
       MEMBERS          LOANS         PAYMENTS
          │              │              │
          │              ▼              │
          │       Member Request        │
          │              │              │
          │              ▼              │
          │      Admin Review           │
          │         /       \           │
          │   Approved     Rejected     │
          │       │                      │
          │       ▼                      │
          │     LOAN                     │
          │       │                      │
          │       ▼                      │
          │  Loan Payments ◄─────────────┘
          │
          ▼
   Weekly Contribution
          │
          ├── Individual recording
          │
          └── Bulk generation
                  │
                  ▼
             All Members
                  │
                  ▼
                AUDIT
          ┌───────┴────────┐
          ▼                ▼
      Loan Audit       Payment Audit
```

## Core Business Rules

### Sinking Fund

- Rate: PHP 50.00 per head per week.
- Collection week starts on Sunday.
- Administrators can record full or partial weekly contributions.
- Bulk generation fills only each member's remaining weekly due.
- Re-running bulk generation does not duplicate amounts already recorded for that week.

### Loans

- Only registered members can request loans.
- Members may have only one pending loan request at a time.
- Members with an ongoing unpaid loan cannot request another loan.
- Administrators review member requests.
- Request status is either **Approved** or **Rejected** after review.
- Administrators retain direct loan creation for administrative/manual cases.
- Loan duration is selected from the supported duration list.
- Loan calculations use the configured interest and penalty rules.

### Payments

- Loan payment submissions require administrator confirmation before they are treated as confirmed repayments.
- Weekly contributions are recorded by administrators.
- Bulk weekly generation records the remaining weekly due for all members.
- Audit remarks use standardized member-name and PHP amount formatting.

## Development Status

### Implemented

- [x] Admin dashboard
- [x] Member management
- [x] Member heads
- [x] Weekly contribution calculation
- [x] Individual weekly contribution recording
- [x] Bulk weekly contribution generation
- [x] Monthly sinking fund monitoring
- [x] Monthly loan collection monitoring
- [x] Member loan requests
- [x] Administrator loan approval/rejection
- [x] Administrator direct loan creation
- [x] Loan repayment records
- [x] Loan payment submission and confirmation workflow
- [x] Loan audit
- [x] Payment audit
- [x] Standardized loan approval/rejection remarks
- [x] Standardized weekly payment audit remarks
- [x] Standardized confirmed loan payment audit remarks

### Future Improvements

Possible future work includes:

- Member contribution history improvements
- Automated repayment schedules
- Automated late-payment and penalty processing
- Financial reports
- PDF/Excel report generation
- Exportable audit records
- Notifications
- Additional role-based permissions
- Additional validation and security hardening

## Security

The application uses authenticated Supabase sessions and role-based API authorization.

Production deployments should continue to enforce:

- Authentication
- Authorization
- Database Row Level Security
- Secure environment variables
- Input validation
- Protection of member financial information
- Audit logging

Never commit real environment files, credentials, or Supabase service-role keys.

## Project Information

**Project:** Dili Labad Members Sinking Fund Management System

**Abbreviation:** DLMSF

**Frontend:** Next.js / React

**API:** Express + TypeScript

**Database:** Supabase / PostgreSQL

**Status:** Under active development
