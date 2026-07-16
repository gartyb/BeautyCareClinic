# Tech Stack

## Frontend

| Layer        | Technology                      |
| ------------ | ------------------------------- |
| Framework    | React 18 + TypeScript           |
| Build tool   | Vite                            |
| UI library   | Tailwind CSS + shadcn/ui        |
| Icons        | Lucide React                    |
| Routing      | React Router v6                 |
| State        | React Context (no Redux)        |
| Locale / RTL | Hebrew, `dir="rtl"` on `<html>` |
| Font         | Assistant (Google Fonts)        |

### Design Tokens (Tailwind)

| Token           | Value     | Use                  |
| --------------- | --------- | -------------------- |
| `clinic-bg`     | `#FFF8F6` | Page background      |
| `clinic-pink`   | `#F6D6D9` | Primary accent       |
| `clinic-blush`  | `#FCEEEF` | Cards and panels     |
| `clinic-gold`   | `#D8B56D` | Highlights, CTAs     |
| `clinic-text`   | `#3A2E2E` | Body text            |
| `clinic-muted`  | `#8A7A7A` | Secondary text       |
| `clinic-border` | `#F1DCDC` | Borders and dividers |

## Backend (Phase 7)

| Layer        | Technology                                      |
| ------------ | ----------------------------------------------- |
| Framework    | ASP.NET Core Web API / .NET 10                  |
| Language     | C# 13                                           |
| ORM          | Entity Framework Core 10 + Npgsql provider      |
| Database     | PostgreSQL 17 (Docker in dev)                   |
| Auth         | ASP.NET Core Identity (HS256 JWT, 24 h tokens)  |
| Auth pattern | Strategy B: `AppUser : IdentityUser<Guid>` in Infrastructure; `Domain.User` as clean POCO |
| Roles        | Manager / Therapist (role-based policies)        |
| Secrets      | `dotnet user-secrets` in dev; env vars in prod   |
| API docs     | Swagger / OpenAPI (Development only)             |
| Tests        | xUnit (~60 tests: unit + InMemory integration)  |

## Deployment (Phase 11)

| Layer          | Technology                                    |
| -------------- | --------------------------------------------- |
| Server         | Ubuntu VPS                                    |
| Reverse proxy  | Nginx via aaPanel (SSL + domains)             |
| Containers     | Docker Compose (api + frontend + postgres)    |

## Architecture Pattern

Clean Architecture — Domain → Application → Infrastructure → Presentation.

Business rules live in Domain and Application. Controllers are thin. EF Core is infrastructure.
