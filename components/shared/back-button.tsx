'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BackButtonProps {
  fallbackHref: string;
  className?: string;
}

export function BackButton({ fallbackHref, className }: BackButtonProps) {
  const router = useRouter();

  const handleClick = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }, [router, fallbackHref]);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleClick}
      aria-label="Go back"
      className={`hover:scale-105 transition-transform duration-200 ${className ?? ''}`}
    >
      <ArrowLeft className="h-4 w-4" />
    </Button>
  );
}
