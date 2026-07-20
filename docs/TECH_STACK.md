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

## Deployment (Phase 013 — interim; see `docs/ARCHITECTURE.md` "Deployment Topology")

| Layer          | Technology                                                          |
| -------------- | -------------------------------------------------------------------- |
| Server         | Contabo VPS, Ubuntu 24.04, aaPanel installed                         |
| Reverse proxy  | aaPanel's nginx — sole public entry (80/443)                         |
| TLS            | Let's Encrypt via certbot, hostname `<ip>.sslip.io` (no domain owned) |
| Frontend/API   | Still dev-mode (Vite dev server, `dotnet run` Development) — reached only through the nginx proxy, not directly |
| Database       | PostgreSQL 17 in Docker, published to `127.0.0.1:5432` only          |

Production-build frontend + `ASPNETCORE_ENVIRONMENT=Production` backend are deferred to a future phase — this table describes the current interim state, not the eventual target.

## Architecture Pattern

Clean Architecture — Domain → Application → Infrastructure → Presentation.

Business rules live in Domain and Application. Controllers are thin. EF Core is infrastructure.
