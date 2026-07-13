# ERD – Beauty Clinic Management System

## Overview

This ERD models the core business entities for a beauty clinic management system. It focuses on customers, orders, treatment packages, treatment tracking, appointments, therapists (represented as Users with roles), payments, and clinic configuration.

The model is intentionally logical and implementation-agnostic so it can be used as input for code generation tools such as Claude Code.

---

## Mermaid ER Diagram

```mermaid
erDiagram

    USER ||--o{ THERAPIST_WORKING_HOURS : defines
    USER ||--o{ THERAPIST_UNAVAILABLE_DATE : blocks
    USER ||--o{ THERAPIST_CAPABILITY : supports
    USER ||--o{ APPOINTMENT : performs
    USER ||--o{ TREATMENT : performs
    USER ||--o{ NOTE : writes

    CUSTOMER ||--o{ CUSTOMER_ORDER : places
    CUSTOMER_ORDER ||--|{ ORDER_ITEM : contains
    PACKAGE_TYPE ||--o{ ORDER_ITEM : purchased_as

    ORDER_ITEM ||--o| TREATMENT_SERIES : creates

    CUSTOMER_ORDER ||--o{ PAYMENT : receives

    CUSTOMER ||--o{ APPOINTMENT : books
    TREATMENT_TYPE ||--o{ APPOINTMENT : requested_for

    CUSTOMER ||--o{ TREATMENT : receives
    TREATMENT_TYPE ||--o{ TREATMENT : classifies
    TREATMENT_SERIES ||--o{ TREATMENT : consumed_by

    TREATMENT ||--o{ TREATMENT_PHOTO : includes

    CUSTOMER ||--o{ NOTE : owns
    TREATMENT_TYPE ||--o{ NOTE : references

    TREATMENT_TYPE ||--o{ PACKAGE_TYPE : defines
    TREATMENT_TYPE ||--o{ THERAPIST_CAPABILITY : required_for

    USER {
        string id PK
        string full_name
        string email
        enum role
    }

    CUSTOMER {
        string id PK
        string full_name
        string phone
        string email
    }

    TREATMENT_TYPE {
        string id PK
        string name
    }

    PACKAGE_TYPE {
        string id PK
        string treatment_type_id FK
        string name
        boolean is_series
        boolean is_timer_based
        integer treatment_count
        integer minutes_per_treatment
    }

    CUSTOMER_ORDER {
        string id PK
        string customer_id FK
        date order_date
        decimal original_price
        decimal discounted_price
        decimal discount_percentage
        integer max_payment_count
        decimal amount_paid
        decimal remaining_balance
    }

    ORDER_ITEM {
        string id PK
        string order_id FK
        string package_type_id FK
    }

    PAYMENT {
        string id PK
        string order_id FK
        decimal amount
        string payment_method
        date payment_date
    }

    TREATMENT_SERIES {
        string id PK
        string order_item_id FK
        integer total_treatments
        integer completed_treatments
        integer total_minutes
        integer used_minutes
    }

    TREATMENT {
        string id PK
        string customer_id FK
        string treatment_type_id FK
        string user_id FK
        string treatment_series_id FK
        datetime treatment_date
        integer duration_minutes
    }

    TREATMENT_PHOTO {
        string id PK
        string treatment_id FK
        string image_url
    }

    APPOINTMENT {
        string id PK
        string customer_id FK
        string treatment_type_id FK
        string user_id FK
        datetime start_time
        datetime end_time
    }

    THERAPIST_WORKING_HOURS {
        string id PK
        string user_id FK
        enum weekday
        string start_time
        string end_time
    }

    THERAPIST_UNAVAILABLE_DATE {
        string id PK
        string user_id FK
        date unavailable_date
    }

    THERAPIST_CAPABILITY {
        string id PK
        string user_id FK
        string treatment_type_id FK
    }

    NOTE {
        string id PK
        string customer_id FK
        string user_id FK
        string treatment_type_id FK
        date note_date
        text content
    }

    GLOBAL_SETTINGS {
        string id PK
        integer default_max_payment_count
    }
```

---

## Main Entities

| Entity                       | Purpose                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| **User**                     | System users (Manager / Therapist). Role determines permissions.                     |
| **Customer**                 | Clinic customer profile.                                                             |
| **TreatmentType**            | Defines available treatment categories.                                              |
| **PackageType**              | Defines packages sold by the clinic. Supports quantity-based and timer-based series. |
| **CustomerOrder**            | Customer purchase transaction.                                                       |
| **OrderItem**                | Individual package purchased within an order.                                        |
| **TreatmentSeries**          | Tracks package usage (treatments or minutes consumed).                               |
| **Payment**                  | Payment made toward an order.                                                        |
| **Appointment**              | Scheduled treatment appointment.                                                     |
| **Treatment**                | Actual treatment performed.                                                          |
| **TreatmentPhoto**           | Photos attached to a treatment.                                                      |
| **TherapistWorkingHours**    | Weekly working schedule for therapist users.                                         |
| **TherapistUnavailableDate** | Days a therapist is unavailable.                                                     |
| **TherapistCapability**      | Which treatment types a therapist can perform.                                       |
| **Note**                     | Internal customer notes.                                                             |
| **GlobalSettings**           | Clinic-wide configuration (currently default maximum payment count).                 |

---

## Design Notes

* `User.role` replaces a separate **Therapist** entity.
* Only users whose `role = therapist` participate in appointments, treatments, notes, schedules, and capabilities.
* `TreatmentSeries` is created only for packages marked as **Series**.
* Timer-based packages accumulate usage using `used_minutes`.
* Completed treatments are derived from:

  ```
  floor(used_minutes / minutes_per_treatment)
  ```
* Orders may contain multiple package types.
* Payments belong to a single order.
* Multiple photos may be attached to a treatment.
* Appointment availability is calculated from:

  * Working hours
  * Unavailable dates
  * Existing appointments
  * Therapist capabilities
