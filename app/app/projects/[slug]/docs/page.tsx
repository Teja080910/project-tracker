'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  BookOpen,
  Plus,
  FileText,
  ChevronRight,
  ChevronDown,
  Trash2,
  Pencil,
  Loader2,
  ArrowLeft,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BackButton } from '@/components/shared/back-button';
import { EmptyState } from '@/components/shared/empty-state';
import { RichTextEditor } from '@/components/shared/rich-text-editor';
import { ConfirmDeleteDialog } from '@/components/shared/confirm-delete-dialog';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { formatRelativeTime, cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Project, ProjectDoc } from '@/lib/types';

interface DocNode extends ProjectDoc {
  children: DocNode[];
}

function buildTree(docs: ProjectDoc[]): DocNode[] {
  const map = new Map<string, DocNode>();
  docs.forEach((d) => map.set(d.id, { ...d, children: [] }));
  const roots: DocNode[] = [];
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function flattenTree(nodes: DocNode[], depth = 0): { id: string; title: string; depth: number }[] {
  const out: { id: string; title: string; depth: number }[] = [];
  nodes.forEach((n) => {
    out.push({ id: n.id, title: n.title, depth });
    out.push(...flattenTree(n.children, depth + 1));
  });
  return out;
}

function DocTreeNode({
  node,
  selectedId,
  collapsed,
  onToggle,
  onSelect,
  onAddChild,
  onDelete,
}: {
  node: DocNode;
  selectedId: string | null;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
  onAddChild: (id: string) => void;
  onDelete: (doc: ProjectDoc) => void;
}) {
  const isOpen = !collapsed.has(node.id);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-0.5 rounded-lg pr-1 transition-colors',
          isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/60'
        )}
      >
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          className="flex h-7 w-6 shrink-0 items-center justify-center text-muted-foreground"
          aria-label={isOpen ? 'Collapse' : 'Expand'}
        >
          {hasChildren ? (
            isOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <span className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm"
        >
          <FileText className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{node.title}</span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
          <button
            type="button"
            onClick={() => onAddChild(node.id)}
            title="Add sub-page"
            aria-label="Add sub-page"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(node)}
            title="Delete page"
            aria-label="Delete page"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {isOpen && hasChildren && (
        <div className="ml-3 space-y-0.5 border-l border-border/60 pl-2">
          {node.children.map((child) => (
            <DocTreeNode
              key={child.id}
              node={child}
              selectedId={selectedId}
              collapsed={collapsed}
              onToggle={onToggle}
              onSelect={onSelect}
              onAddChild={onAddChild}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProjectDocsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectDocsContent />
    </Suspense>
  );
}

function ProjectDocsContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const projectSlug = params.slug as string;
  const selectedId = searchParams.get('doc');

  const [project, setProject] = useState<Project | null>(null);
  const [docs, setDocs] = useState<ProjectDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [newPageOpen, setNewPageOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newParentId, setNewParentId] = useState('none');
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectDoc | null>(null);
  const [deleting, setDeleting] = useState(false);

  const selectDoc = useCallback(
    (id: string | null) => {
      setEditing(false);
      const base = `/app/projects/${projectSlug}/docs`;
      router.replace(id ? `${base}?doc=${id}` : base, { scroll: false });
    },
    [router, projectSlug]
  );

  const fetchData = useCallback(async () => {
    if (!user) return;
    const { data: projectData } = await supabase
      .from('projects')
      .select('*')
      .eq('slug', projectSlug)
      .maybeSingle();
    setProject(projectData as Project | null);
    if (!projectData) {
      setLoading(false);
      return;
    }
    const { data: docsData } = await supabase
      .from('project_docs')
      .select('*')
      .eq('project_id', projectData.id)
      .order('created_at', { ascending: true });
    setDocs((docsData as ProjectDoc[]) ?? []);
    setLoading(false);
  }, [user, projectSlug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const tree = useMemo(() => buildTree(docs), [docs]);
  const flatDocs = useMemo(() => flattenTree(tree), [tree]);
  const selectedDoc = useMemo(
    () => docs.find((d) => d.id === selectedId) ?? null,
    [docs, selectedId]
  );

  const toggleCollapsed = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openNewPage = (parentId: string | null) => {
    setNewTitle('');
    setNewParentId(parentId ?? 'none');
    setNewPageOpen(true);
  };

  const createPage = async () => {
    if (!project || !user) return;
    const title = newTitle.trim() || 'Untitled';
    setCreating(true);
    const { data, error } = await supabase
      .from('project_docs')
      .insert({
        project_id: project.id,
        parent_id: newParentId === 'none' ? null : newParentId,
        title,
        content: '',
        created_by: user.id,
        updated_by: user.id,
      })
      .select()
      .single();
    setCreating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewPageOpen(false);
    await fetchData();
    const created = data as ProjectDoc;
    selectDoc(created.id);
    setEditTitle(title);
    setEditContent('');
    setEditing(true);
    toast.success('Page created');
  };

  const startEdit = () => {
    if (!selectedDoc) return;
    setEditTitle(selectedDoc.title);
    setEditContent(selectedDoc.content);
    setEditing(true);
  };

  const saveDoc = async () => {
    if (!selectedDoc || !user) return;
    const title = editTitle.trim() || 'Untitled';
    setSaving(true);
    const { error } = await supabase
      .from('project_docs')
      .update({ title, content: editContent, updated_by: user.id })
      .eq('id', selectedDoc.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEditing(false);
    await fetchData();
    toast.success('Page saved');
  };

  const deleteDoc = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('project_docs').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (selectedId === deleteTarget.id) selectDoc(null);
    await fetchData();
    toast.success('Page deleted');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Skeleton className="h-64" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Project not found.</p>
        <Button variant="outline" className="mt-4" asChild>
          <a href="/app/projects">Back to Projects</a>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 animate-fade-in-up sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <BackButton fallbackHref={`/app/projects/${projectSlug}`} />
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BookOpen className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">Docs</h1>
              <p className="truncate text-sm text-muted-foreground">{project.name}</p>
            </div>
          </div>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => openNewPage(null)}>
          <Plus className="h-4 w-4 mr-2" />
          New Page
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Pages tree */}
        <div className={cn(selectedDoc ? 'hidden lg:block' : 'block')}>
          <Card>
            <CardContent className="p-2">
              {flatDocs.length === 0 ? (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No pages yet
                </div>
              ) : (
                <div className="space-y-0.5">
                  {tree.map((node) => (
                    <DocTreeNode
                      key={node.id}
                      node={node}
                      selectedId={selectedId}
                      collapsed={collapsed}
                      onToggle={toggleCollapsed}
                      onSelect={selectDoc}
                      onAddChild={(id) => openNewPage(id)}
                      onDelete={(doc) => setDeleteTarget(doc)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Page content */}
        <div className={cn(!selectedDoc ? 'hidden lg:block' : 'block')}>
          <Card className="min-h-[420px]">
            <CardContent className="p-5 sm:p-6">
              {!selectedDoc ? (
                <EmptyState
                  icon={BookOpen}
                  title={flatDocs.length === 0 ? 'No documentation yet' : 'No page selected'}
                  description={
                    flatDocs.length === 0
                      ? 'Create the first page to start documenting this project'
                      : 'Choose a page from the list or create a new one'
                  }
                  action={
                    flatDocs.length === 0 ? (
                      <Button size="sm" onClick={() => openNewPage(null)}>
                        New Page
                      </Button>
                    ) : undefined
                  }
                />
              ) : editing ? (
                <div className="space-y-4">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="text-lg font-semibold"
                    placeholder="Page title"
                  />
                  <RichTextEditor
                    key={selectedDoc.id}
                    content={editContent}
                    onChange={setEditContent}
                    projectId={project.id}
                    placeholder="Start writing..."
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                      Cancel
                    </Button>
                    <Button onClick={saveDoc} disabled={saving}>
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => selectDoc(null)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
                        aria-label="All pages"
                      >
                        <ArrowLeft className="h-4 w-4" />
                      </button>
                      <h1 className="truncate text-xl font-semibold tracking-tight">
                        {selectedDoc.title}
                      </h1>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={startEdit}>
                        <Pencil className="h-4 w-4 mr-1.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(selectedDoc)}
                        aria-label="Delete page"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Updated {formatRelativeTime(selectedDoc.updated_at)}
                  </p>
                  <div className="mt-5">
                    {selectedDoc.content ? (
                      <div
                        className="doc-content"
                        dangerouslySetInnerHTML={{ __html: selectedDoc.content }}
                      />
                    ) : (
                      <p className="text-sm italic text-muted-foreground">
                        This page is empty. Click Edit to start writing.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* New page dialog */}
      <Dialog open={newPageOpen} onOpenChange={setNewPageOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Getting started"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !creating) createPage();
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Parent page</label>
              <Select value={newParentId} onValueChange={setNewParentId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top level)</SelectItem>
                  {flatDocs.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {`${'— '.repeat(d.depth)}${d.title}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={createPage} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Page"
        description={`Delete "${deleteTarget?.title}"? Sub-pages will be kept and moved to the top level.`}
        confirmText={deleteTarget?.title ?? ''}
        onConfirm={deleteDoc}
        loading={deleting}
      />
    </div>
  );
}
