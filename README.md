# panwar_employee_dash

React 19 + Vite SPA — the **internal staff portal** for the Panwar Portals project. Panwar Health employees sign in via Microsoft Entra ID (M365 SSO) and use the modular tools hub to manage clients, brands, placements, and the data feeding the client dashboards.

**Production:** `https://staff.panwarhealth.com.au`
**Local dev:** `http://localhost:5174`

## Quick start

```bash
npm install
# Make sure panwar_api is running on :7071 in another shell
cd ../panwar_api && func start
# Then in this folder:
npm run dev
```

Open http://localhost:5174 — you'll be redirected to /login. **Sign-in is currently a stub** — the Entra ID app registration ("Panwar Portals — Employee SSO") is on the punch list and the API doesn't yet validate Entra JWTs. To poke around the authed UI locally before that lands, manually insert an `AppUser` row with `Type=1` (Employee) and seed a session cookie.

See `CLAUDE.md` for the full architecture, conventions, and route reference.

## Stack

- Vite 6 + React 19 + TypeScript strict
- Tailwind CSS + hand-rolled shadcn-style primitives
- TanStack Router (file-based) + TanStack Query
- React Hook Form + Zod (when forms get built)
- lucide-react for sidebar icons
- No charts yet — Recharts gets added when there's a chart to draw

## Hosting

Production deploys to **Cloudflare Pages** from the `main` branch to `staff.panwarhealth.com.au`. The `staging` branch (when it exists) deploys to `staging.staff.panwarhealth.com.au`. Other branches get throwaway `*.pages.dev` preview URLs (UI-only — auth cookies don't reach `*.pages.dev`).

## Build conventions

- Strict TypeScript — `tsc -b` must pass clean
- No raw `fetch` in components — use `src/api/`
- No tokens in JavaScript — auth is HttpOnly cookies on `.panwarhealth.com.au`
- All API calls use `credentials: 'include'`
- Path alias `@/` for `src/`
- **Never commit `.env.*` files** — `.gitignore` covers `.env` and `.env.*` with `!.env.example` as the only exception. Build-time env vars live in the Cloudflare Pages dashboard (Settings → Environment variables → Production / Preview)

## Project layout

```
src/
├── api/           # apiFetch wrapper + per-resource clients
├── components/    # shared UI (EmployeeShell, Sidebar, AuthShell, ui/*)
├── hooks/         # useAuth, useHasRole, useLogout
├── lib/           # utilities (cn, etc.)
└── routes/        # file-based routes (TanStack Router)
    ├── __root.tsx
    ├── index.tsx          # / → /app redirect
    ├── login.tsx          # /login (Entra stub)
    ├── app.tsx            # /app/* shell + auth guard
    ├── app.index.tsx      # /app overview
    └── app.<page>.tsx     # /app/<page> stub pages for the Dashboard Updater module
```

## Repo siblings

- [`panwar_api`](../panwar_api) — C# backend
- [`panwar_client_dash`](../panwar_client_dash) — client portal
- [`panwar_portals`](../panwar_portals) — project manager folder
