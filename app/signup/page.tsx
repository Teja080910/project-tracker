'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, ArrowRight } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/app');
    });
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else if (data.session) {
      router.push('/app');
    } else {
      toast.success('Account created! Please check your email to verify.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center auth-bg px-4 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute top-0 right-1/4 w-72 h-72 bg-chart-2/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s' }} />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '7s', animationDelay: '2s' }} />

      <div className="w-full max-w-sm space-y-6 relative animate-fade-in-up">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-blue text-primary-foreground text-2xl font-bold shadow-card animate-fade-in-scale">
            T
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Create account</h1>
            <p className="text-sm text-muted-foreground mt-1">Get started with Trackflow</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/80 backdrop-blur-md shadow-elevated p-6 space-y-4 animate-fade-in-scale stagger-1">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                className="h-11"
              />
            </div>
            <Button type="submit" className="w-full h-11 group" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : (
                <>
                  Create account
                  <ArrowRight className="h-4 w-4 ml-2 transition-transform duration-200 group-hover:translate-x-0.5" />
                </>
              )}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <button
              onClick={() => router.push('/login')}
              className="text-primary font-medium hover:underline transition-colors duration-200"
            >
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
