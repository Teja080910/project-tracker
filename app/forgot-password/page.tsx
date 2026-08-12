'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase/client';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { APP_NAME, APP_LOGO_URL, APP_INITIAL } from '@/lib/app-config';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (!existing) {
      toast.error('No account found with this email address');
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
      toast.success('Password reset link sent to your email');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center auth-bg px-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/3 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s' }} />

      <div className="w-full max-w-sm space-y-6 relative animate-fade-in-up">
        <div className="flex flex-col items-center gap-3">
          {APP_LOGO_URL ? (
            <img src={APP_LOGO_URL} alt={APP_NAME} className="h-14 w-14 rounded-2xl object-contain shadow-card" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-blue text-primary-foreground text-2xl font-bold shadow-card animate-fade-in-scale">
              {APP_INITIAL}
            </div>
          )}
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Reset password</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {sent ? 'Check your email for a reset link' : `Enter your email to receive a reset link for ${APP_NAME}`}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/80 backdrop-blur-md shadow-elevated p-6 animate-fade-in-scale stagger-1">
          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11"
                />
              </div>
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send reset link
              </Button>
            </form>
          ) : (
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <p className="text-sm text-muted-foreground">
                If an account exists for {email}, you will receive a password reset link shortly.
              </p>
            </div>
          )}
        </div>

        <button
          onClick={() => router.push('/login')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mx-auto transition-colors duration-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to sign in
        </button>
      </div>
    </div>
  );
}
