'use client';

import Link from 'next/link';
import { FolderKanban } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getProjectStatusMeta } from '@/lib/constants';
import { cn, formatDate } from '@/lib/utils';
import type { Project } from '@/lib/types';

const STATUS_COLORS: Record<string, string> = {
  gray: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  green: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
};

export function ProjectCard({ project, index = 0 }: { project: Project; index?: number }) {
  const statusMeta = getProjectStatusMeta(project.status);

  return (
    <Link href={`/app/projects/${project.slug}`} className="block">
      <Card className={cn('card-hover h-full animate-fade-in-up', `stagger-${Math.min(index + 1, 7)}`)}>
        <CardContent className="flex h-full flex-col p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FolderKanban className="h-4 w-4" />
            </div>
            <Badge variant="outline" className={cn('text-[10px]', STATUS_COLORS[statusMeta.color])}>
              {statusMeta.label}
            </Badge>
          </div>
          <h3 className="font-semibold text-sm mb-1">{project.name}</h3>
          {project.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{project.description}</p>
          )}
          <div className="mt-auto flex items-center gap-3 pt-3 text-xs text-muted-foreground">
            <span className="truncate">
              {project.client_name ? `Client: ${project.client_name}` : 'Internal'}
            </span>
            <span className="ml-auto shrink-0">{formatDate(project.created_at)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
