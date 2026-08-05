'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getInitials } from '@/lib/utils';
import type { Profile } from '@/lib/types';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  profile?: Pick<Profile, 'full_name' | 'email' | 'avatar_url'> | null;
  className?: string;
}

export function UserAvatar({ profile, className }: UserAvatarProps) {
  const initials = getInitials(profile?.full_name, profile?.email);
  return (
    <Avatar className={cn('h-8 w-8', className)}>
      {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? ''} />}
      <AvatarFallback className="text-xs font-medium bg-secondary text-secondary-foreground">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
