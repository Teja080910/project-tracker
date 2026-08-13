'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { FolderKanban, Plus, Search, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { PaginationControls } from '@/components/shared/pagination';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { getProjectStatusMeta } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import type { Project } from '@/lib/types';

const colorClasses: Record<string, string> = {
  gray: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
  blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  green: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
  red: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
};

export default function ProjectsPage() {
  const { profile, user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // New project modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [clientName, setClientName] = useState('');
  const [status, setStatus] = useState('active');
  const [creating, setCreating] = useState(false);

  const fetchProjects = useCallback(async () => {
    if (!user || !profile) return;
    let query = supabase.from('projects').select('*').order('created_at', { ascending: false });
    if (profile?.role !== 'super_admin') {
      const { data: memberships } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id);
      const projectIds = memberships?.map((m) => m.project_id) ?? [];
      if (projectIds.length === 0) {
        setProjects([]);
        setLoading(false);
        return;
      }
      query = supabase.from('projects').select('*').in('id', projectIds).order('created_at', { ascending: false });
    }
    const { data } = await query;
    setProjects((data as Project[]) ?? []);
    setLoading(false);
  }, [user, profile]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = async () => {
    if (!user) return;
    if (!name.trim()) {
      toast.error('Project name is required');
      return;
    }
    setCreating(true);
    const { data, error } = await supabase
      .from('projects')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        client_name: clientName.trim() || null,
        status,
        owner_id: user.id,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      setCreating(false);
      return;
    }

    try {
      await supabase.from('project_members').insert({
        project_id: data.id,
        user_id: user.id,
        role: 'project_admin',
      });
      await supabase.from('activity_logs').insert({
        project_id: data.id,
        user_id: user.id,
        action: 'created project',
        entity_type: 'project',
        entity_id: data.id,
      });
      setModalOpen(false);
      setName('');
      setDescription('');
      setClientName('');
      setStatus('active');
      await fetchProjects();
      toast.success('Project created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Project created but setup failed');
    }
    setCreating(false);
  };

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (p.client_name?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-1">{projects.length} total</p>
        </div>
        {profile?.role === 'super_admin' && (
          <Button className="animate-fade-in-scale" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        )}
      </div>

      {/* New Project modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g. Mobile App"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of the project..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="client">Client Name</Label>
                <Input
                  id="client"
                  placeholder="e.g. Acme Corp"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={createProject} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="relative max-w-sm animate-fade-in-up stagger-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-secondary/40 border-transparent focus-visible:bg-card transition-colors duration-200"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="animate-fade-in-up stagger-2">
          <CardContent className="py-6">
            <EmptyState
              icon={FolderKanban}
              title={search ? "No projects found" : "No projects yet"}
              description={search ? "Try a different search term" : "Create your first project to get started"}
              action={
                !search && profile?.role === 'super_admin' ? (
                  <Button onClick={() => setModalOpen(true)}>New Project</Button>
                ) : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pageItems.map((project, i) => {
            const statusMeta = getProjectStatusMeta(project.status);
            return (
              <Link key={project.id} href={`/app/projects/${project.slug}`}>
                <Card className={`card-hover cursor-pointer h-full animate-fade-in-up stagger-${Math.min(i + 1, 7)} group relative overflow-hidden`}>
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500/0 via-blue-500/0 to-blue-500/0 group-hover:from-blue-500/30 group-hover:via-blue-500/50 group-hover:to-blue-500/30 transition-all duration-300" />
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
                        <FolderKanban className="h-4 w-4" />
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs ${colorClasses[statusMeta.color]}`}
                      >
                        {statusMeta.label}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors duration-200">{project.name}</h3>
                    {project.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{project.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {project.client_name && <span>Client: {project.client_name}</span>}
                      <span className="ml-auto">{formatDate(project.created_at)}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      <PaginationControls
        page={page}
        pageSize={PAGE_SIZE}
        total={filtered.length}
        onPageChange={setPage}
      />
    </div>
  );
}
