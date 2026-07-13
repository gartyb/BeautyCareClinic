# CLAUDE.md

# Project

This repository contains the Beauty Clinic Management System.

The system helps beauty clinics manage customers, treatments, appointments, payments, products and business operations.

---

# Development Process

Follow the global development methodology defined in:

`~/.claude/development/DEVELOPMENT_MANUAL.md`

The development pipeline and subagent responsibilities are defined in:

`~/.claude/development/DEVELOPMENT_PIPELINE.md`

---

# Project Documentation

The project knowledge base is located under:

`docs/`

Before planning or implementing any feature, read the relevant project documentation.

The documentation in `docs/` is the primary source of truth for this project.

Keep it synchronized with the implementation.

---

# UI

Visual mockups are located under:

`docs/mockups/`

When implementing UI:

* Use the mockups as the visual source of truth.
* Keep the UI elegant, calm and intuitive.
* Preserve a premium beauty-clinic appearance.
* Use soft pink and champagne gold as the primary design language.
* Support Hebrew and RTL.

---

# Architecture

The project follows Clean Architecture.

Business rules must remain inside the Application and Domain layers.

Avoid business logic inside UI components, controllers or infrastructure.

---

# Business Goal

The highest priority screen is the Customer Card.

The therapist should understand the customer's complete status within a few seconds.

Every new feature should improve or support this workflow.

---

# Project Rules

* Do not invent business rules.
* Ask clarification questions whenever documentation is ambiguous.
* Prefer simple, maintainable solutions.
* Reuse existing components whenever appropriate.
* Do not implement functionality outside the approved phase scope.

---

# Phase Management

Project progress is managed using:

* `PROJECT_STATUS.md`
* `CHANGE_REQUESTS.md`
* `phases/phase-XXX/PHASE_SUMMARY.md`

Claude must keep these files synchronized according to the global development manual.

---

# Additional Documentation

Read only when relevant.

| Document             | Purpose                     |
| -------------------- | --------------------------- |
| SYSTEM_OVERVIEW.md   | Product overview            |
| ARCHITECTURE.md      | System architecture         |
| TECH_STACK.md        | Technologies                |
| DOMAIN_MODEL.md      | Business entities and rules |
| DATABASE_SCHEMA.md   | Database structure          |
| API_SPECIFICATION.md | APIs                        |
| UI.md                | Screens and UX              |
| WORKFLOWS.md         | Business workflows          |

## Project Root

All project files referenced in this repository are relative to the repository root.

Examples:

- docs/
- phases/
- PROJECT_STATUS.md
- CHANGE_REQUESTS.md

Never assume system directories such as:

- /www
- /var
- /home
- /opt

Always use paths relative to the repository root unless the user explicitly specifies an absolute path.
