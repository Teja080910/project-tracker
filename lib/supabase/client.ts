'use client';

/**
 * Supabase-compatible facade over the platform API.
 *
 * Keeps the fluent `.from().select().eq()...` chains and `.channel()` realtime
 * usage the app already has, but every call is authorized by the NestJS API.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4105';
const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_URL ?? 'http://127.0.0.1:4100';
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://127.0.0.1:4105/ws';
const FILES_BASE =
  process.env.NEXT_PUBLIC_FILES_URL ?? 'http://127.0.0.1:19000/pt-task-screenshots';

export type QueryError = { message: string; code?: string; details?: string; hint?: string };
/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase-style builder erases row types */
export type QueryResult<T = any> = {
  data: any;
  error: QueryError | null;
  count?: number;
};

type Row = Record<string, unknown>;

async function getToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const response = await fetch(`${AUTH_URL}/api/auth/token`, { credentials: 'include' });
    if (!response.ok) return null;
    const data = (await response.json()) as { token?: string };
    return data.token ?? null;
  } catch {
    return null;
  }
}

function toError(response: Response, body: unknown): QueryError {
  const payload = body as { error?: { message?: string; code?: string } } | null;
  return {
    message: payload?.error?.message ?? response.statusText ?? 'Request failed',
    code: payload?.error?.code ?? String(response.status),
  };
}

async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('authorization', `Bearer ${token}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  return fetch(`${API_URL}${path}`, { ...init, headers });
}

type Filter = { column: string; value: unknown };
type InFilter = { column: string; values: unknown[] };

class QueryBuilder<T = any> implements PromiseLike<QueryResult<T>> {
  declare readonly __rowType?: T;
  private eqs: Filter[] = [];
  private neqs: Filter[] = [];
  private ins: InFilter[] = [];
  private orderBy?: { column: string; ascending: boolean };
  private limitCount?: number;
  private singleMode?: 'true' | 'maybe';
  private countMode = false;
  private headMode = false;
  private action: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private payload?: unknown;
  private rangeFrom?: number;
  private rangeTo?: number;
  private offsetCount?: number;

  constructor(private readonly table: string) {}

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    if (options?.count === 'exact') this.countMode = true;
    if (options?.head) this.headMode = true;
    return this;
  }

  ilike(column: string, pattern: string) {
    this.eqs.push({ column, value: pattern.replace(/%/g, '') });
    return this;
  }

  or(expression: string) {
    const match = expression.match(/^([\w.]+)\.ilike\.(.+)$/);
    if (match) this.eqs.push({ column: match[1]!, value: match[2]!.replace(/%/g, '') });
    return this;
  }

  eq(column: string, value: unknown) {
    this.eqs.push({ column, value });
    return this;
  }

  neq(column: string, value: unknown) {
    this.neqs.push({ column, value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.ins.push({ column, values });
    return this;
  }

  is(column: string, value: unknown) {
    if (value === null) this.eqs.push({ column, value: null });
    return this;
  }

  not(column: string, operator: string, value: unknown) {
    if (operator === 'is' && value === null) this.neqs.push({ column, value: null });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: options?.ascending ?? true };
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    this.offsetCount = from;
    this.limitCount = to - from + 1;
    return this;
  }

  single() {
    this.singleMode = 'true';
    return this;
  }

  maybeSingle() {
    this.singleMode = 'maybe';
    return this;
  }

  insert(value: unknown) {
    this.action = 'insert';
    this.payload = value;
    return this;
  }

  upsert(value: unknown, _options?: { onConflict?: string }) {
    this.action = 'upsert';
    this.payload = value;
    return this;
  }

  update(value: unknown) {
    this.action = 'update';
    this.payload = value;
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  private queryString(): string {
    const params = new URLSearchParams();
    const eqs: string[] = [];
    for (const filter of this.eqs) {
      if (filter.value === null) eqs.push(`${filter.column}:`);
      else eqs.push(`${filter.column}:${String(filter.value)}`);
    }
    if (eqs.length) params.set('eq', eqs.join(','));
    if (this.neqs.length) {
      params.set('neq', this.neqs.map((filter) => `${filter.column}:${String(filter.value)}`).join(','));
    }
    if (this.ins.length) {
      params.set('in', this.ins.map((filter) => `${filter.column}:${filter.values.map(String).join('|')}`).join(','));
    }
    if (this.orderBy) params.set('order', `${this.orderBy.column}:${this.orderBy.ascending ? 'asc' : 'desc'}`);
    if (this.limitCount) params.set('limit', String(this.limitCount));
    if (this.offsetCount) params.set('offset', String(this.offsetCount));
    if (this.singleMode) params.set('single', this.singleMode);
    if (this.countMode) params.set('count', 'true');
    if (this.headMode) params.set('head', 'true');
    return params.toString();
  }

  async execute(): Promise<QueryResult<T>> {
    try {
      const query = this.queryString();
      const withQuery = query ? `?${query}` : '';

      if (this.action === 'select') {
        const response = await apiFetch(`/api/pt/data/${this.table}${withQuery}`);
        const body = await response.json().catch(() => null);
        if (!response.ok) return { data: null, error: toError(response, body) };
        if (this.countMode && this.headMode) {
          return { data: null, error: null, count: Number(body) };
        }
        return { data: body as T, error: null };
      }

      if (this.action === 'insert') {
        const response = await apiFetch(`/api/pt/data/${this.table}`, {
          method: 'POST',
          body: JSON.stringify(this.payload),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) return { data: null, error: toError(response, body) };
        return { data: body as T, error: null };
      }

      if (this.action === 'upsert') {
        const response = await apiFetch(`/api/pt/data/${this.table}/upsert`, {
          method: 'POST',
          body: JSON.stringify({ value: this.payload }),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) return { data: null, error: toError(response, body) };
        return { data: body as T, error: null };
      }

      if (this.action === 'update') {
        const response = await apiFetch(`/api/pt/data/${this.table}${withQuery}`, {
          method: 'PATCH',
          body: JSON.stringify(this.payload),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) return { data: null, error: toError(response, body) };
        return { data: body as T, error: null };
      }

      const response = await apiFetch(`/api/pt/data/${this.table}${withQuery}`, { method: 'DELETE' });
      const body = await response.json().catch(() => null);
      if (!response.ok) return { data: null, error: toError(response, body) };
      return { data: body as T, error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : 'Network error' } };
    }
  }

  then<TResult1 = QueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

type RealtimeHandler = (payload: { new: Row; old: Row; eventType: string }) => void;

type ChannelSubscription = {
  kind: 'postgres_changes';
  table: string;
  event: string;
  filter?: string;
  handler: RealtimeHandler;
};

class Channel {
  private subscriptions: ChannelSubscription[] = [];
  private socket: WebSocket | null = null;
  private topics = new Set<string>();
  private closed = false;
  private retry: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly name: string) {}

  on(
    kind: 'postgres_changes',
    options: { event: string; schema?: string; table: string; filter?: string },
    handler: RealtimeHandler,
  ) {
    this.subscriptions.push({ kind, table: options.table, event: options.event, filter: options.filter, handler });
    return this;
  }

  subscribe(): this {
    void this.connect();
    return this;
  }

  private topicFor(subscription: ChannelSubscription): string | null {
    if (subscription.table === 'comment_reactions') {
      return `reactions:${this.name.split(':')[1] ?? ''}`;
    }
    if (subscription.table === 'comments') {
      return this.name.startsWith('comments:') ? this.name : null;
    }
    if (subscription.table === 'notifications') {
      return this.name.startsWith('notifications:') ? this.name : null;
    }
    return null;
  }

  private async connect(): Promise<void> {
    if (this.closed) return;
    const token = await getToken();
    if (!token) {
      this.retry = setTimeout(() => void this.connect(), 3000);
      return;
    }

    const socket = new WebSocket(WS_URL);
    this.socket = socket;

    socket.addEventListener('open', () => {
      socket.send(JSON.stringify({ type: 'auth', token }));
    });

    socket.addEventListener('message', (event) => {
      let message: Row;
      try {
        message = JSON.parse(String(event.data)) as Row;
      } catch {
        return;
      }
      if (message.type === 'ready') {
        const topics = [...new Set(this.subscriptions.map((sub) => this.topicFor(sub)).filter(Boolean))] as string[];
        for (const topic of topics) {
          this.topics.add(topic);
          socket.send(JSON.stringify({ type: 'subscribe', topics: [topic] }));
        }
        return;
      }
      this.dispatch(message);
    });

    socket.addEventListener('close', () => {
      if (this.closed) return;
      this.retry = setTimeout(() => void this.connect(), 2500);
    });
  }

  private dispatch(message: Row): void {
    const topic = String(message.topic ?? '');
    for (const subscription of this.subscriptions) {
      if (this.topicFor(subscription) !== topic) continue;
      if (message.type === 'comment.created' && subscription.event === 'INSERT') {
        subscription.handler({ new: message.comment as Row, old: {}, eventType: 'INSERT' });
      }
      if (message.type === 'comment.deleted' && subscription.event === 'DELETE') {
        subscription.handler({ new: {}, old: { id: message.commentId } as Row, eventType: 'DELETE' });
      }
      if (message.type === 'reaction.added' && subscription.event === 'INSERT') {
        subscription.handler({ new: message.reaction as Row, old: {}, eventType: 'INSERT' });
      }
      if (message.type === 'reaction.removed' && subscription.event === 'DELETE') {
        subscription.handler({
          new: {},
          old: { id: message.reactionId, comment_id: message.commentId, user_id: message.userId, emoji: message.emoji } as Row,
          eventType: 'DELETE',
        });
      }
      if (message.type === 'notification.created' && subscription.event === 'INSERT') {
        subscription.handler({ new: message.notification as Row, old: {}, eventType: 'INSERT' });
      }
    }
  }

  unsubscribe(): this {
    this.close();
    return this;
  }

  close(): void {
    this.closed = true;
    if (this.retry) clearTimeout(this.retry);
    this.socket?.close();
    this.socket = null;
  }
}

const channels = new Set<Channel>();

async function fetchSession() {
  try {
    const response = await fetch(`${AUTH_URL}/api/auth/get-session`, { credentials: 'include', cache: 'no-store' });
    if (!response.ok) return null;
    const body = (await response.json()) as { session?: Row; user?: Row } | null;
    if (!body?.session || !body.user) return null;

    const tokenRes = await fetch(`${AUTH_URL}/api/auth/token`, { credentials: 'include', cache: 'no-store' });
    const token = tokenRes.ok ? ((await tokenRes.json()) as { token?: string }).token ?? '' : '';
    const user = {
      id: String(body.user.id),
      email: String(body.user.email ?? ''),
      user_metadata: {
        full_name: body.user.name,
        name: body.user.name,
        avatar_url: body.user.image,
        picture: body.user.image,
      },
      app_metadata: { role: (body.user as { role?: string }).role ?? 'user' },
      aud: 'authenticated',
      role: String((body.user as { role?: string }).role ?? 'authenticated'),
      created_at: String(body.user.createdAt ?? new Date().toISOString()),
      image: body.user.image ?? null,
      name: body.user.name ?? '',
    };
    return {
      access_token: token,
      refresh_token: '',
      expires_at: new Date(String(body.session.expiresAt ?? Date.now())).getTime() / 1000,
      user,
    };
  } catch {
    return null;
  }
}

type AuthListener = (event: string, session: Awaited<ReturnType<typeof fetchSession>>) => void;
const listeners = new Set<AuthListener>();

function notify(event: string, session: Awaited<ReturnType<typeof fetchSession>>) {
  for (const listener of listeners) listener(event, session);
}

export const supabase = {
  from<T = Row>(table: string): QueryBuilder<T> {
    return new QueryBuilder<T>(table);
  },

  channel(name: string): Channel {
    const channel = new Channel(name);
    channels.add(channel);
    return channel;
  },

  removeChannel(channel: Channel): void {
    channel.close();
    channels.delete(channel);
  },

  auth: {
    async getUser(_jwt?: string) {
      const session = await fetchSession();
      return { data: { user: session?.user ?? null }, error: null };
    },

    async getSession(): Promise<{ data: { session: Awaited<ReturnType<typeof fetchSession>> }; error: QueryError | null }> {
      const session = await fetchSession();
      return { data: { session }, error: null };
    },

    onAuthStateChange(handler: AuthListener) {
      listeners.add(handler);
      void fetchSession().then((session) => handler(session ? 'SIGNED_IN' : 'SIGNED_OUT', session));
      return { data: { subscription: { unsubscribe: () => listeners.delete(handler) } } };
    },

    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const response = await fetch(`${AUTH_URL}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        return { data: { user: null, session: null }, error: { message: body?.message ?? 'Invalid credentials' } };
      }
      const session = await fetchSession();
      notify('SIGNED_IN', session);
      return { data: { user: session?.user ?? null, session }, error: null };
    },

    async signUp({ email, password, options }: { email: string; password: string; options?: { data?: Record<string, unknown> } }) {
      const name = String(options?.data?.full_name ?? options?.data?.name ?? email.split('@')[0]);
      const response = await fetch(`${AUTH_URL}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password, name }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        return { data: { user: null, session: null }, error: { message: body?.message ?? 'Could not sign up' } };
      }
      const session = await fetchSession();
      notify('SIGNED_IN', session);
      return { data: { user: session?.user ?? null, session }, error: null };
    },

    async signInWithOAuth({ provider, options }: { provider: string; options?: { redirectTo?: string } }) {
      const callbackURL = options?.redirectTo ?? `${window.location.origin}/auth/callback`;
      const errorCallbackURL = `${window.location.origin}/login?error=auth`;
      const response = await fetch(`${AUTH_URL}/api/auth/sign-in/social`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider, callbackURL, errorCallbackURL }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { message?: string } | null;
        return { data: null, error: { message: body?.message ?? 'OAuth unavailable' } };
      }
      const data = (await response.json()) as { url?: string };
      if (data.url) window.location.href = data.url;
      return { data: null, error: null };
    },

    async signOut() {
      await fetch(`${AUTH_URL}/api/auth/sign-out`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      }).catch(() => undefined);
      notify('SIGNED_OUT', null);
      return { error: null };
    },

    async resetPasswordForEmail(email: string, options?: { redirectTo?: string }) {
      const response = await fetch(`${AUTH_URL}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, redirectTo: options?.redirectTo }),
      });
      if (!response.ok) return { data: null, error: { message: 'Could not send reset email' } };
      return { data: {}, error: null };
    },

    admin: {
      async createUser(input: { email: string; password?: string; email_confirm?: boolean; user_metadata?: Record<string, unknown> }) {
        const token = await getToken();
        const response = await fetch(`${AUTH_URL}/admin/users`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({
            email: input.email,
            password: input.password,
            name: String(input.user_metadata?.full_name ?? input.email.split('@')[0]),
          }),
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) return { data: { user: null }, error: toError(response, body) };
        return { data: body, error: null };
      },
      async listUsers() {
        const token = await getToken();
        const response = await fetch(`${AUTH_URL}/admin/users`, {
          headers: token ? { authorization: `Bearer ${token}` } : {},
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) return { data: { users: [] }, error: toError(response, body) };
        return { data: body, error: null };
      },
    },
  },

  storage: {
    from(bucket: string) {
      return {
        getPublicUrl(objectPath: string) {
          const base = FILES_BASE.replace(/\/$/, '');
          return { data: { publicUrl: `${base}/${objectPath.replace(/^\/+/, '')}` } };
        },
        async upload(objectPath: string, file: File | Blob | Buffer, options?: { contentType?: string; upsert?: boolean; cacheControl?: string }) {
          const token = await getToken();
          if (!token) return { data: null, error: { message: 'Not signed in' } };
          const presignRes = await fetch(`${API_URL}/api/uploads/presign`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
            body: JSON.stringify({
              fileName: objectPath.split('/').pop() ?? 'file',
              contentType: options?.contentType ?? (file as File).type,
            }),
          });
          if (!presignRes.ok) return { data: null, error: { message: 'Could not prepare upload' } };
          const presign = (await presignRes.json()) as { uploadUrl: string; objectKey: string; headers: Record<string, string> };
          const put = await fetch(presign.uploadUrl, {
            method: 'PUT',
            headers: { ...presign.headers, 'content-type': options?.contentType ?? (file as File).type },
            body: file,
          });
          if (!put.ok) return { data: null, error: { message: 'Upload failed' } };
          return { data: { path: presign.objectKey }, error: null };
        },
        async remove(paths: string[]) {
          const token = await getToken();
          if (!token) return { data: null, error: { message: 'Not signed in' } };
          for (const path of paths) {
            await fetch(`${API_URL}/api/uploads/object?key=${encodeURIComponent(path)}`, {
              method: 'DELETE',
              headers: { authorization: `Bearer ${token}` },
            }).catch(() => undefined);
          }
          return { data: {}, error: null };
        },
        async list(_prefix?: string) {
          return { data: [], error: null };
        },
        async download(objectPath: string) {
          const token = await getToken();
          if (!token) return { data: null, error: { message: 'Not signed in' } };
          const response = await fetch(`${API_URL}/api/uploads/object?key=${encodeURIComponent(objectPath)}`, {
            headers: { authorization: `Bearer ${token}` },
          });
          if (!response.ok) return { data: null, error: { message: 'Not found' } };
          const { url } = (await response.json()) as { url: string };
          const file = await fetch(url);
          return { data: await file.blob(), error: null };
        },
      };
    },
  },

  removeAllChannels(): void {
    for (const channel of channels) channel.close();
    channels.clear();
  },
};

export type SupabaseClient = typeof supabase;
export type User = NonNullable<Awaited<ReturnType<typeof fetchSession>>>['user'];
export type Session = NonNullable<Awaited<ReturnType<typeof fetchSession>>>;
