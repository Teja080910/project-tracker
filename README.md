# Trackflow

A project management application built with Next.js, TypeScript, and Supabase.

## Tech Stack

- **Framework:** Next.js 13 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS, shadcn/ui
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase CLI (for running migrations locally)

### 1. Install dependencies

```bash
npm install
```

### 2. Environment Variables

Copy these into `.env`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Get these from Supabase Dashboard > Project Settings > API.

### 3. Run Database Migrations

**Option A — Supabase CLI (local development):**

```bash
supabase start
supabase migration up
```

**Option B — Supabase Dashboard (production):**

1. Go to Supabase Dashboard > SQL Editor
2. Open and run `supabase/migrations/20260803103443_create_project_management_schema.sql`
3. Then run `supabase/migrations/20260803104217_add_storage_policies.sql`

**Option C — Supabase CLI (remote project):**

```bash
supabase link --project-ref your-project-ref
supabase db push
```

### 4. Create a Storage Bucket

In Supabase Dashboard > Storage, create a public bucket named `task-screenshots`.

### 5. Run the dev server

```bash
npm run dev
```

## Creating an Admin User

New users default to the `viewer` role. To create a `super_admin`:

### Via the script

```bash
npm run make-admin -- admin@example.com
```

Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env`.

### Via Supabase SQL Editor

```sql
UPDATE public.profiles SET role = 'super_admin' WHERE email = 'admin@example.com';
```

### Via Supabase Dashboard

1. Authentication > Users > Add User
2. Table Editor > `profiles` > change role to `super_admin`

## Features

- **Projects** — Create and manage projects with status tracking
- **Versions** — Organize work into versions/releases within projects
- **Tasks** — Track tasks, bugs, stories, and issues with priorities and assignees
- **Comments** — Discuss tasks with threaded comments
- **Screenshots** — Upload images via file picker, drag-and-drop, or clipboard paste
- **Notifications** — In-app notifications for assignments, status changes, and comments
- **Activity Log** — Audit trail of all actions
- **Global Search** — Search across projects, tasks, and users
- **User Management** — Super admins can create users, change roles, and disable accounts
- **Role-Based Access** — 5 roles: super_admin, project_admin, developer, tester, viewer
- **Dark Mode** — Light/dark theme toggle

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript checks |
| `npm run make-admin -- <email>` | Promote a user to super_admin |

## Project Structure

```
├── app/              # Next.js App Router pages
│   ├── app/          # Authenticated routes (dashboard, projects, tasks, users, etc.)
│   ├── login/        # Login page
│   └── signup/       # Signup page
├── components/       # React components
│   ├── shared/       # Shared components (sidebar, topbar, badges, etc.)
│   └── ui/           # shadcn/ui primitives
├── lib/              # Utilities, types, constants, Supabase clients
├── scripts/          # CLI scripts
└── supabase/         # Database migrations
```
