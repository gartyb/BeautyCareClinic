# System Overview — Beauty Clinic Management System

## Product Summary

A management system for beauty clinics. Centralizes customers, treatment series, orders, payments, appointments, therapists, and clinic settings in one place.

The primary screen is the **Customer Card** — the therapist must understand the customer's full status within a few seconds.

## Target Users

| Role      | Capabilities                                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------ |
| Manager   | Full access: create and edit all data, manage therapists, configure package types and global settings. |
| Therapist | Create orders and payments. Record treatments and notes. Run treatment timers. Cannot edit after save. |

## Core Capabilities

| Area                 | Description                                                                  |
| -------------------- | ---------------------------------------------------------------------------- |
| Customer profiles    | Create, search, and view customers. See appointments, balance, and actions.  |
| Orders and payments  | Multi-package orders with installment payments. Balance tracked automatically.|
| Treatment series     | Quantity-based and timer-based series. Usage tracked per series.             |
| Treatment timer      | Start, pause, resume, and reset. Duration accumulated per series.            |
| Treatment history    | Record treatments with photos. Customer gallery per customer.                |
| Appointments         | Schedule based on therapist availability, working hours, and treatment type. |
| Therapist management | Define schedules, unavailable dates, and treatment capabilities.             |
| Package types        | Define packages with series and timer options. Managed by managers only.    |
| Global settings      | Default maximum payment count per order.                                     |

## Build Order

1. **Phase 1 — Frontend** — React with mock data. Customer Card screen first.
2. **Phase 2 — Backend** — ASP.NET Core API + PostgreSQL. Replace mock data.
3. **Phase 3 — Deployment** — Docker Compose on Ubuntu VPS.

## Out of Scope

- Customer self-service booking
- Automated appointment reminders
- Online payment collection
- Inventory and product management
- Marketing campaigns
- Business analytics and reports
- Edit history and previous-value tracking
