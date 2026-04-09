# panwar_employee_dash — Claude notes

This is the **employee portal** SPA for Panwar Portals. It is one of three repos:

- `F:/Github/panwar_api` — C# Azure Functions backend (.NET 9 isolated)
- `F:/Github/panwar_client_dash` — client-facing portal
- **`F:/Github/panwar_employee_dash` — this repo (internal staff portal)**

When working in this repo, keep your changes scoped to this folder. Cross-repo changes are coordinated from `F:/Github/panwar_portals/CLAUDE.md` which has the org-wide rules.

---

## What this app does

Internal Panwar Health staff (Maria, Gabriel, Elena, etc.) sign in here to manage everything that feeds the client dashboards. The first and only module is the **Dashboard Updater** — CRUD for clients/brands/audiences/publishers, KPI baselines, manual actuals entry, the bulk importer for publisher monthly templates, the inbox for client comments and the publish/approve workflow.

The brief calls for a "modular shell" pattern where the sidebar lists every module the user has access to. We are deliberately **not** building the registry abstraction yet — there's only one module. Once a second module (Reports, Notifications, Settings, …) lands we'll extract it. Three concrete uses before abstracting.

---

## Architecture (mirror of panwar_client_dash)

- **Vite 6** + **React 19** + **TypeScript strict**
- **TanStack Router** file-based routing — every file under `src/routes/**/*.tsx` is a route, generated into `routeTree.gen.ts` by `tsr generate` (runs as part of `npm run build` and `npm run dev`)
- **TanStack Query** for data fetching, with the QueryClient passed into the router context so route loaders can use it
- **Tailwind** for styling, hand-rolled shadcn-style primitives in `src/components/ui/` (Card, Button, Input). No shadcn CLI.
- **lucide-react** for icons (sidebar nav items)
- **PH brand colours only** — no per-client theming here. Employees serve every client and switching colour palette every time you click between clients is awful.

The shell is `src/components/EmployeeShell.tsx` — persistent left sidebar (`Sidebar.tsx`) + top bar with user identity + sign out + content `<Outlet />`. Auth-guarded by `src/routes/app.tsx`.

Auth pages use `src/components/AuthShell.tsx` — centred card on a neutral background.

---

## Auth flow

### How it will work (target)

1. User clicks **Sign in with Microsoft** on `/login`
2. MSAL.js redirects to Entra ID for the `panwarhealth.com.au` tenant
3. User signs in with their `@panwarhealth.com.au` account
4. Microsoft redirects back with an Entra ID JWT
5. Frontend sends the Entra JWT to `panwar_api` `/api/auth/entra/exchange`
6. API validates the JWT against the configured `ENTRA_TENANT_ID` + `ENTRA_EMPLOYEE_SSO_AUDIENCE`, calls `AuthService.GetOrCreateEmployeeUserAsync` to upsert an `AppUser` row, maps Entra group membership to portal roles (`panwar-admin`, `panwar-dashboard-editor`, `panwar-dashboard-viewer`), mints a panwar-portals JWT and sets it as an HttpOnly cookie on `.panwarhealth.com.au`
7. Frontend now hits `/api/auth/me` to bootstrap the user state — this is what `useAuth()` does

Same HttpOnly cookie pattern as the client portal — JS never touches the JWT.

### What's actually wired right now

**Steps 1-6 do not exist yet.** The Entra ID app registration is on the punch list. The login button is a deliberate dead end (`alert(...)`) so anyone running the dash locally sees what's missing rather than a confusing infinite loading spinner.

`useAuth()`, `getMe()`, `logout()`, the auth guard in `routes/app.tsx`, and the `EmployeeShell` user identity display are all wired and ready — they just need a real session cookie to read. To poke around the authed UI locally before Entra is wired, manually insert an `AppUser` row with `Type=1` (Employee) and a corresponding session JWT cookie via the API's `JwtService` (you can do this from a unit test or a temporary dev endpoint).

---

## Routes (what exists)

| Path | File | What it does |
|---|---|---|
| `/` | `routes/index.tsx` | Redirect to `/app` |
| `/login` | `routes/login.tsx` | Sign-in page (Entra stub) |
| `/app` | `routes/app.tsx` + `app.index.tsx` | Auth-guarded shell + module overview |
| `/app/inbox` | `routes/app.inbox.tsx` | Inbox stub — client comments + unapproved months |
| `/app/placements` | `routes/app.placements.tsx` | Placements CRUD stub |
| `/app/import` | `routes/app.import.tsx` | Bulk importer stub |
| `/app/clients` | `routes/app.clients.tsx` | Clients CRUD stub |
| `/app/brands` | `routes/app.brands.tsx` | Brands & audiences CRUD stub |
| `/app/publishers` | `routes/app.publishers.tsx` | Publishers CRUD stub |
| `/app/baselines` | `routes/app.baselines.tsx` | Per-client publisher baselines stub |

Every Dashboard Updater page is currently a Card explaining what will land there. Implementation order is up to whatever Maria needs first; the brief points at the bulk importer as "the big time-saver" since that replaces the most painful piece of the existing spreadsheet workflow.

---

## Conventions (apply to every file)

- **Strict TypeScript.** `tsc -b` must pass clean. `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` all on.
- **No raw `fetch` in components.** Always go through `src/api/client.ts → apiFetch<T>()`. Always sends `credentials: 'include'`. Throws `ApiError` with the parsed body on non-2xx.
- **No tokens in JavaScript.** No `Authorization` headers, no `localStorage`. The HttpOnly cookie does all auth.
- **No `.env.*` files in git.** `.gitignore` blocks `.env` and `.env.*` with `!.env.example` as the only exception. Production env vars (`VITE_API_BASE_URL`, etc.) live in the Cloudflare Pages dashboard under Settings → Environment variables.
- **Never commit secrets.** The dash never has any client-side secrets — every secret lives server-side in `panwar_api`'s Azure App Settings. The dash only ever has public values like the API URL.
- **Path alias `@/` for `src/`.**
- **Don't reach for a state library.** TanStack Query handles all server state. There is no client-side state worth managing globally (the auth user + per-page UI state via `useState` is enough).
- **Don't add a module registry pattern until a second module exists.** Hardcode the sidebar in `Sidebar.tsx` for now.
- **Don't add a charting library until there's a chart to draw.** Recharts gets installed when the first chart needs it.

---

## Cross-repo dependencies

The DTOs the API returns (`MeResponse`, future `DashboardResponse`, etc.) are mirrored as TypeScript interfaces in `src/api/`. There is no codegen — when the API changes, update the interface by hand. The interfaces are small and rarely change.

The `MeResponse.type` field is `'client' | 'employee'`. Employees only — the auth guard in `routes/app.tsx` redirects client users to `/login` (which then doesn't help them, but they shouldn't be here in the first place; they belong on `portal.panwarhealth.com.au`).
