import {
  CheckCircle2,
  Circle,
  CircleDot,
  CircleSlash,
  Bug,
  ListTodo,
  BookHeadphones,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import type { TaskPriority, TaskStatus, TaskType } from '@/lib/types';

export const TASK_TYPES: { value: TaskType; label: string; icon: LucideIcon; color: string }[] = [
  { value: 'task', label: 'Task', icon: ListTodo, color: 'blue' },
  { value: 'bug', label: 'Bug', icon: Bug, color: 'red' },
  { value: 'story', label: 'Story', icon: BookHeadphones, color: 'green' },
  { value: 'issue', label: 'Issue', icon: AlertTriangle, color: 'amber' },
];

export const TASK_STATUSES: { value: TaskStatus; label: string; icon: LucideIcon; color: string }[] = [
  { value: 'open', label: 'Open', icon: Circle, color: 'gray' },
  { value: 'in_progress', label: 'In Progress', icon: CircleDot, color: 'blue' },
  { value: 'completed', label: 'Completed', icon: CheckCircle2, color: 'green' },
  { value: 'cancelled', label: 'Cancelled', icon: CircleSlash, color: 'red' },
];

export const TASK_PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'gray' },
  { value: 'medium', label: 'Medium', color: 'blue' },
  { value: 'high', label: 'High', color: 'amber' },
  { value: 'critical', label: 'Critical', color: 'red' },
];

export const PROJECT_STATUSES = [
  { value: 'active', label: 'Active', color: 'green' },
  { value: 'completed', label: 'Completed', color: 'blue' },
  { value: 'archived', label: 'Archived', color: 'gray' },
] as const;

export const VERSION_STATUSES = [
  { value: 'active', label: 'Active', color: 'blue' },
  { value: 'released', label: 'Released', color: 'green' },
  { value: 'archived', label: 'Archived', color: 'gray' },
] as const;

export const ROLES = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'project_admin', label: 'Project Admin' },
  { value: 'developer', label: 'Developer' },
  { value: 'tester', label: 'Tester' },
  { value: 'viewer', label: 'Viewer' },
] as const;

export function getTaskTypeMeta(type: string) {
  return TASK_TYPES.find((t) => t.value === type) ?? TASK_TYPES[0];
}

export function getTaskStatusMeta(status: string) {
  return TASK_STATUSES.find((s) => s.value === status) ?? TASK_STATUSES[0];
}

export function getTaskPriorityMeta(priority: string) {
  return TASK_PRIORITIES.find((p) => p.value === priority) ?? TASK_PRIORITIES[1];
}

export function getProjectStatusMeta(status: string) {
  return PROJECT_STATUSES.find((s) => s.value === status) ?? PROJECT_STATUSES[0];
}

export function getVersionStatusMeta(status: string) {
  return VERSION_STATUSES.find((s) => s.value === status) ?? VERSION_STATUSES[0];
}

export function getRoleLabel(role: string) {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}
