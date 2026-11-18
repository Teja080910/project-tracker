# Trackflow

A project management application built with Next.js, TypeScript, and the platform API.

## Tech Stack

- **Framework:** Next.js 13 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS, shadcn/ui
- **Database:** PostgreSQL via platform API
- **Auth:** Platform auth
- **Storage:** Object storage via platform API
- **Realtime:** Platform WebSocket gateway

## Getting Started

### Prerequisites

- Node.js 18+
- Platform API, auth and file services running

### 1. Install dependencies

```bash
npm install
```

### 2. Environment Variables

Copy `.env.sample` to `.env.local` and fill in the values:

```
NEXT_PUBLIC_API_URL=http://127.0.0.1:4105
NEXT_PUBLIC_AUTH_URL=http://127.0.0.1:4100
NEXT_PUBLIC_WS_URL=ws://127.0.0.1:4105/ws
NEXT_PUBLIC_FILES_URL=http://127.0.0.1:19000/pt-task-screenshots
```

Optional: SMTP settings for email notifications and VAPID keys for browser push.

### 3. Run the dev server

```bash
npm run dev
```

The app runs at `http://localhost:3005`.

## User Roles

Roles are managed by the platform backend. Super admins can manage users from the
Users page in the app.

## Features

- **Teams** — Admins create teams; each team has its own projects and members
- **Projects** — Create and manage team projects with status tracking
- **Versions** — Organize work into versions/releases within projects
- **Tasks** — Track tasks, bugs, stories, and issues with priorities and assignees
- **Comments** — Discuss tasks with threaded comments
- **Screenshots** — Upload images via file picker, drag-and-drop, or clipboard paste
- **Notifications** — In-app notifications for assignments, status changes, and comments
- **Activity Log** — Audit trail of all actions
- **Global Search** — Search across projects, tasks, and users
- **User Management** — Admins can create users; super admins can change global roles and disable accounts
- **Role-Based Access** — Super admin (everything), admin (teams/projects), team admin (everything inside a team), project admin (everything inside a project), developer, tester, viewer
- **Move Projects** — Global admins can move a project from one team to another
- **Dark Mode** — Light/dark theme toggle

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript checks |

## Project Structure

```
├── app/              # Next.js App Router pages
│   ├── app/          # Authenticated routes (dashboard, projects, tasks, users, etc.)
│   ├── login/        # Login page
│   └── signup/       # Signup page
├── components/       # React components
│   ├── shared/       # Shared components (sidebar, topbar, badges, etc.)
│   └── ui/           # shadcn/ui primitives
└── lib/              # Utilities, types, constants, platform API clients
```
