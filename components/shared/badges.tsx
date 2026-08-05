'use client';

import { Badge } from '@/components/ui/badge';
import { getTaskStatusMeta, getTaskPriorityMeta, getTaskTypeMeta } from '@/lib/constants';
import { cn } from '@/lib/utils';

const colorClasses: Record<string, string> = {
  gray: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  green: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = getTaskStatusMeta(status);
  const Icon = meta.icon;
  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5 font-medium transition-colors duration-200', colorClasses[meta.color], className)}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}

export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  const meta = getTaskPriorityMeta(priority);
  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5 font-medium transition-colors duration-200', colorClasses[meta.color], className)}
    >
      <span className={cn('h-2 w-2 rounded-full transition-transform duration-200', {
        'bg-gray-400': meta.color === 'gray',
        'bg-blue-500': meta.color === 'blue',
        'bg-amber-500': meta.color === 'amber',
        'bg-red-500': meta.color === 'red',
      })} />
      {meta.label}
    </Badge>
  );
}

export function TypeBadge({ type, className }: { type: string; className?: string }) {
  const meta = getTaskTypeMeta(type);
  const Icon = meta.icon;
  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5 font-medium transition-colors duration-200', colorClasses[meta.color], className)}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </Badge>
  );
}
