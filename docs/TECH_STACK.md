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

## Backend (Phase 2)

| Layer     | Technology                             |
| --------- | -------------------------------------- |
| Framework | ASP.NET Core Web API / .NET 10 LTS     |
| Language  | C#                                     |
| ORM       | Entity Framework Core 10               |
| Database  | PostgreSQL                             |
| Auth      | ASP.NET Core Identity + Roles/Policies |

## Deployment (Phase 3)

| Layer          | Technology                                    |
| -------------- | --------------------------------------------- |
| Server         | Ubuntu VPS                                    |
| Reverse proxy  | Nginx via aaPanel (SSL + domains)             |
| Containers     | Docker Compose (api + frontend + postgres)    |

## Architecture Pattern

Clean Architecture — Domain → Application → Infrastructure → Presentation.

Business rules live in Domain and Application. Controllers are thin. EF Core is infrastructure.
