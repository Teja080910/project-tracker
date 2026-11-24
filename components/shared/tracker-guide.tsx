'use client';

import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FolderKanban,
  GitBranch,
  KeyRound,
  ListChecks,
  Lock,
  MessageSquare,
  ShieldCheck,
  Tag,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Step = { icon: LucideIcon; title: string; text: string };

function Flow({ steps }: { steps: Step[] }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <div key={step.title} className="flex flex-1 items-center gap-2">
            <div className="flex-1 rounded-xl border border-border/60 bg-secondary/30 p-3">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="text-sm font-semibold">{step.title}</span>
              </div>
              <p className="text-xs text-muted-foreground">{step.text}</p>
            </div>
            {index < steps.length - 1 && (
              <>
                <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
                <ArrowDown className="mx-auto h-4 w-4 shrink-0 text-muted-foreground sm:hidden" />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

const ROLES: { role: string; color: string; text: string }[] = [
  {
    role: 'Super Admin',
    color: 'border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400',
    text: 'Full access to every team, project and admin setting.',
  },
  {
    role: 'Team Admin',
    color: 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400',
    text: 'Manages the team, its projects, members and access requests.',
  },
  {
    role: 'Project Admin',
    color: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    text: 'Manages one project: members, versions, tags and tasks.',
  },
  {
    role: 'Developer',
    color: 'border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400',
    text: 'Works on tasks, comments and changes status once approved.',
  },
  {
    role: 'Tester',
    color: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    text: 'Verifies work, checks test cases and moves tasks to Testing Completed.',
  },
  {
    role: 'Viewer',
    color: 'border-gray-500/20 bg-gray-500/10 text-gray-600 dark:text-gray-400',
    text: 'Read-only access to the projects they belong to.',
  },
];

export function TrackerGuide() {
  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="h-4 w-4" />
          Tracker guide
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">How work flows in the tracker</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Everything lives inside a team. Open a team to find its projects, then drill into versions,
          tasks and subtasks. This page explains the structure, approvals, access and chat in a few
          pictures.
        </p>
      </div>

      <Card className="animate-fade-in-up stagger-1">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <GitBranch className="h-4 w-4" />
            Structure
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Flow
            steps={[
              { icon: UsersRound, title: 'Team', text: 'People and their projects. Open projects from here.' },
              { icon: FolderKanban, title: 'Project', text: 'A product or client engagement inside the team.' },
              { icon: Tag, title: 'Version', text: 'A release or milestone that groups tasks.' },
              { icon: ListChecks, title: 'Task', text: 'A piece of work with status, priority and assignee.' },
              { icon: GitBranch, title: 'Subtask', text: 'Break a task down; subtasks can nest further.' },
            ]}
          />
          <p className="mt-3 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs text-muted-foreground">
            There is no separate Projects page. Go to <span className="font-medium text-foreground">Teams</span> and
            open a team to see its projects.
          </p>
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up stagger-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            Task approvals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Flow
            steps={[
              { icon: ListChecks, title: 'Task created', text: 'Starts as Open; no approval needed while unassigned.' },
              { icon: UsersRound, title: 'Assigned', text: 'Assigning someone puts the task in Pending approval.' },
              { icon: CheckCircle2, title: 'Approved', text: 'The assignee (or a project admin) approves the task.' },
              { icon: GitBranch, title: 'Work starts', text: 'Status can now change until the task is done.' },
            ]}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-amber-600 dark:text-amber-400">Pending:</span> the status dropdown is
              locked until the assignee approves.
            </div>
            <div className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Reassigning</span> keeps the approval; the task creator can
              request approval again if needed.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up stagger-3">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="h-4 w-4" />
            Access: teams vs projects
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Flow
            steps={[
              { icon: UsersRound, title: 'Team member', text: 'Sees every project listed in their team.' },
              { icon: Lock, title: 'Open a project', text: 'Without a project role, a lock panel is shown.' },
              { icon: KeyRound, title: 'Request access', text: 'Sends a request to the team admins and owner.' },
              { icon: CheckCircle2, title: 'Admin approves', text: 'You are added as a project member and can open it.' },
            ]}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Team admin:</span> opens every project in the team and
              approves access requests from the project page.
            </div>
            <div className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Project member:</span> opens that project and works on its
              tasks.
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up stagger-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Chat, replies and threads
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { title: 'Copy', text: 'Copy any message (or attachment name) from its action row.' },
              { title: 'Reply', text: 'Reply to a message; the composer shows what you are answering.' },
              { title: 'Threads', text: 'Replies group under the original message in a collapsible thread.' },
              { title: 'Edit / delete', text: 'Edit or delete your own messages; threads vanish when empty.' },
            ].map((item) => (
              <div key={item.title} className="rounded-lg border border-border/60 bg-secondary/30 px-3 py-2">
                <p className="text-xs font-semibold">{item.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Use <span className="font-medium text-foreground">@name</span> to mention someone — they get an in-app,
            email and push notification.
          </p>
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up stagger-5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Roles at a glance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ROLES.map((item) => (
              <div key={item.role} className="rounded-lg border border-border/60 px-3 py-2">
                <Badge variant="outline" className={`text-[10px] ${item.color}`}>
                  {item.role}
                </Badge>
                <p className="mt-1.5 text-xs text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="animate-fade-in-up stagger-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick start</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            {[
              'Open Teams and pick a team (or ask an admin to add you).',
              'Open a project card, or request access if you see the lock panel.',
              'Create a version, then add tasks inside it.',
              'Assign the task — the assignee approves it before work starts.',
              'Break work into subtasks and talk it through in the task chat.',
              'Move the status forward as work progresses — check all test cases before marking Testing Completed.',
            ].map((text, index) => (
              <li key={text} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="text-muted-foreground">{text}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
