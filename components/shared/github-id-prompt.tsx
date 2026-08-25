'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Github } from 'lucide-react';
import { toast } from 'sonner';

export function GithubIdPrompt() {
  const { profile, refreshProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile && !profile.github_id) {
      setValue(profile.github_id ?? '');
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [profile]);

  const isValid = (v: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/.test(v);

  const handleSave = async () => {
    const v = value.trim();
    if (!isValid(v)) {
      toast.error('Enter a valid GitHub username or email');
      return;
    }
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ github_id: v }).eq('id', profile.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshProfile();
    setOpen(false);
    toast.success('GitHub ID saved');
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md [&>button]:hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="h-5 w-5" />
            GitHub ID Required
          </DialogTitle>
          <DialogDescription>
            Please add your GitHub ID or email to complete your profile. This is required for all users.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="github-id-prompt">
            GitHub ID / Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="github-id-prompt"
            placeholder="e.g. teja-dev or you@example.com"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
            }}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={saving || !value.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
