import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { TrackerGuide } from '@/components/shared/tracker-guide';
import { APP_NAME, APP_LOGO_URL } from '@/lib/app-config';

export default function PublicGuidePage() {
  return (
    <div className="min-h-screen bg-background dashboard-bg">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-md">
        <Link
          href="/login"
          className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {APP_LOGO_URL && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={APP_LOGO_URL} alt={APP_NAME} className="h-6 w-6 rounded object-contain" />
          )}
          <span className="text-sm font-semibold">{APP_NAME}</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <TrackerGuide />
      </main>
    </div>
  );
}
