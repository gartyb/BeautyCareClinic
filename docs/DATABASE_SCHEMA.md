# Database Schema

Database: PostgreSQL. ORM: Entity Framework Core 10. All IDs are UUIDs.

## ER Diagram

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
        uuid id PK
        string full_name
        string email
        enum role
    }

    CUSTOMER {
        uuid id PK
        string full_name
        string phone
        string email
    }

    TREATMENT_TYPE {
        uuid id PK
        string name
    }

    PACKAGE_TYPE {
        uuid id PK
        uuid treatment_type_id FK
        string name
        boolean is_series
        boolean is_timer_based
        integer treatment_count
        integer minutes_per_treatment
    }

    CUSTOMER_ORDER {
        uuid id PK
        uuid customer_id FK
        date order_date
        decimal original_price
        decimal discounted_price
        decimal discount_percentage
        integer max_payment_count
        decimal amount_paid
        decimal remaining_balance
    }

    ORDER_ITEM {
        uuid id PK
        uuid order_id FK
        uuid package_type_id FK
    }

    PAYMENT {
        uuid id PK
        uuid order_id FK
        decimal amount
        string payment_method
        date payment_date
    }

    TREATMENT_SERIES {
        uuid id PK
        uuid order_item_id FK
        integer total_treatments
        integer completed_treatments
        integer total_minutes
        integer used_minutes
    }

    TREATMENT {
        uuid id PK
        uuid customer_id FK
        uuid treatment_type_id FK
        uuid user_id FK
        uuid treatment_series_id FK
        datetime treatment_date
        integer duration_minutes
    }

    TREATMENT_PHOTO {
        uuid id PK
        uuid treatment_id FK
        string image_url
    }

    APPOINTMENT {
        uuid id PK
        uuid customer_id FK
        uuid treatment_type_id FK
        uuid user_id FK
        datetime start_time
        datetime end_time
    }

    THERAPIST_WORKING_HOURS {
        uuid id PK
        uuid user_id FK
        enum weekday
        string start_time
        string end_time
    }

    THERAPIST_UNAVAILABLE_DATE {
        uuid id PK
        uuid user_id FK
        date unavailable_date
    }

    THERAPIST_CAPABILITY {
        uuid id PK
        uuid user_id FK
        uuid treatment_type_id FK
    }

    NOTE {
        uuid id PK
        uuid customer_id FK
        uuid user_id FK
        uuid treatment_type_id FK
        date note_date
        text content
    }

    GLOBAL_SETTINGS {
        uuid id PK
        string name UK
        string value
    }
```

## Design Notes

- `User.role` is `Manager` or `Therapist`. No separate Therapist table.
- `TreatmentSeries` is created only for `PackageType.is_series = true` packages.
- `completed_treatments` for timer-based series is derived: `floor(used_minutes / minutes_per_treatment)`. Updated after each timer session.
- `GLOBAL_SETTINGS` is a key-value table. Each setting is a separate row with a unique `name` and a string `value`. Currently defined: `default_max_payment_count`.
