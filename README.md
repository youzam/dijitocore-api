# DijitoTrack API

Enterprise-grade Installment & Portfolio Management Platform  
Built by **DijitoLabs**

---

## 🚀 Overview

DijitoTrack is a B2B SaaS platform designed for businesses that operate on installment-based sales models.

It enables companies to:

- Manage customers
- Create and track installment contracts
- Record and reconcile payments
- Monitor overdue accounts
- Automate reminders and escalations
- Track staff performance
- Generate financial insights
- Manage subscription packages (SaaS billing layer)

This repository contains the backend API powering the DijitoTrack platform.

---

## 🏗 Architecture

- **Runtime:** Node.js
- **Framework:** Express
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** JWT
- **Localization:** en / sw (i18n enabled)
- **Background Jobs:** Distributed-safe job runner with DB locks
- **Subscription Engine:** Feature-based access control (SaaS authority layer)

---

## 🧠 Core Modules

### 1. Authentication

- JWT-based auth
- OTP verification
- PIN management (customer)
- Role-based access

### 2. Business Management

- Multi-tenant architecture
- Business lifecycle (ACTIVE → GRACE → SUSPENDED → TERMINATED)

### 3. Customer Management

- Blacklisting
- Import support
- SMS welcome automation
- Contract-level linking

### 4. Contract Engine

- Installment scheduling
- Flexible frequencies
- Downpayment validation
- Termination & approval flow

### 5. Payment Engine

- Manual & gateway payments
- Reversals with approval flow
- Reconciliation logic
- Webhook validation
- Gateway abstraction (Selcom, Mpesa, Airtel)

### 6. Notifications System

- IN_APP
- PUSH
- SMS
- EMAIL
- WHATSAPP
- Retry engine with failure tracking
- Quiet hours support
- Feature-gated SMS enforcement

### 7. Dashboard & Analytics

- Portfolio snapshot
- Cashflow projections
- Staff performance metrics
- Asset metrics
- Health score calculation
- Insights engine

### 8. Subscription Authority (SaaS Layer)

- Package-based feature control
- Usage metering
- SMS limits
- Customer limits
- Grace period enforcement
- Automatic suspension

---

## 🔐 Security

- Role-based access control
- Multi-tenant isolation (businessId scoped)
- Subscription-based feature enforcement
- Webhook signature validation
- Device token isolation
- Duplicate notification guard
- Distributed-safe cron locking

---

## 🔁 Background Jobs

The system includes production-safe scheduled jobs:

- Reminder Job
- Escalation Job
- Subscription Lifecycle Job
- Notification Retry Job
- Dashboard Snapshot Job
- Device Cleanup Job

All jobs:

- Use DB-based locking
- Prevent multi-instance collision
- Support graceful shutdown

---

## 🌍 Localization

Supports:

- English (en)
- Swahili (sw)

Locale integrity is enforced via:

- Runtime validation
- CI parity checks
- Structure freeze validation
- Unused key detection

---

## ⚙ Environment Variables

Example:

All required environment variables must be configured before deployment.

---

## 🛠 Setup

### Install dependencies

npm install

### Run migrations

npx prisma migrate deploy

### Start development server

npm run dev

### Start production server

npm start

---

## 🧪 CI Checks

Locale parity:

npm run check:locale

Structure validation:

npm run check:locale-structure

Unused keys detection:

npm run check:locale-unused

---

## 📊 Multi-Tenancy Model

Every core entity is scoped by:

- businessId

This ensures strict tenant isolation across:

- Customers
- Contracts
- Payments
- Notifications
- Dashboard snapshots
- Subscriptions

---

## 📦 Subscription Packages

System supports feature-based SaaS packages:

- Starter
- Pro
- (Premium – planned)

Each package controls:

- Feature availability
- Usage limits
- SMS quotas
- Customer limits

---

## 📈 Scaling Strategy

Designed for:

- Horizontal scaling
- Multi-instance deployment
- Job lock coordination
- Database-driven concurrency control
- Retry-safe notification delivery

---

## 🏢 Ownership

Product: DijitoTrack  
Company: DijitoLabs  
Type: B2B SaaS  
Domain: Installment & Portfolio Management

---

## 📜 License

Proprietary software.  
All rights reserved by DijitoLabs.

Unauthorized copying, modification, or distribution is prohibited.
