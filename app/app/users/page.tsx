'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users, UserPlus, X, Search, Shield, UserCog } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { UserAvatar } from '@/components/shared/user-avatar';
import { EmptyState } from '@/components/shared/empty-state';
import { PaginationControls } from '@/components/shared/pagination';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { ROLES, getRoleLabel } from '@/lib/constants';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import Link from 'next/link';
import type { Profile } from '@/lib/types';

export default function UsersPage() {
  const { profile, user } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('viewer');
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const isSuperAdmin = profile?.role === 'super_admin';

  const fetchUsers = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setUsers((data as Profile[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  if (!isSuperAdmin) {
    return (
      <div className="text-center py-12">
        <Shield className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">You don&apos;t have permission to manage users.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/app">Back to Dashboard</Link>
        </Button>
      </div>
    );
  }

  const filtered = users.filter(
    (u) =>
      (u.full_name?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const updateRole = async (userId: string, role: string) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    if (error) {
      toast.error(error.message);
    } else {
      await fetchUsers();
      toast.success('Role updated');
    }
  };

  const toggleDisabled = async (userId: string, disabled: boolean) => {
    const { error } = await supabase.from('profiles').update({ disabled: !disabled }).eq('id', userId);
    if (error) {
      toast.error(error.message);
    } else {
      await fetchUsers();
      toast.success(disabled ? 'User enabled' : 'User disabled');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.auth.admin.createUser({
      email: newEmail,
      password: newPassword,
      user_metadata: { full_name: newName },
    });
    if (error) {
      toast.error(error.message);
      setCreating(false);
    } else if (data.user) {
      await supabase.from('profiles').update({ role: newRole, full_name: newName }).eq('id', data.user.id);
      toast.success('User created');
      setNewEmail('');
      setNewName('');
      setNewPassword('');
      setNewRole('viewer');
      setAddOpen(false);
      fetchUsers();
    }
    setCreating(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground mt-1">{users.length} total users</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Full Name</label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="John Doe" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="you@example.com" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Role</label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creating...' : 'Create User'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm animate-fade-in-up stagger-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <EmptyState icon={Users} title="No users found" />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {pageItems.map((u, i) => (
            <div key={u.id} className={`flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:shadow-soft hover:border-foreground/20 transition-all duration-200 animate-fade-in-up stagger-${Math.min(i + 1, 7)}`}>
              <UserAvatar profile={u} className="h-9 w-9" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{u.full_name ?? u.email}</span>
                  {u.disabled && <Badge variant="outline" className="text-xs text-red-500">Disabled</Badge>}
                  {u.id === user?.id && <Badge variant="outline" className="text-xs">You</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={u.role} onValueChange={(v) => updateRole(u.id, v)} disabled={u.id === user?.id}>
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {u.id !== user?.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => toggleDisabled(u.id, u.disabled)}
                  >
                    {u.disabled ? 'Enable' : 'Disable'}
                  </Button>
                )}
              </div>
            </div>
          ))}
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
