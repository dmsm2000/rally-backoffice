import { Injectable, computed, signal } from '@angular/core';
import { PostgrestError, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * - `setup-needed`: signed in, but is_admin() doesn't exist yet — migration 0045 hasn't been applied.
 * - `denied`: signed in with an account that isn't in public.admins.
 */
export type Access = 'loading' | 'signed-out' | 'admin' | 'denied' | 'setup-needed' | 'error';

export function isMissingFunction(error: Pick<PostgrestError, 'code' | 'message'>): boolean {
  return error.code === 'PGRST202' || /could not find the function/i.test(error.message);
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly session = signal<Session | null>(null);
  readonly access = signal<Access>('loading');
  readonly email = computed(() => this.session()?.user.email ?? '');

  private readonly ready: Promise<void>;

  constructor() {
    this.ready = this.restore();
    // Only signals in here: supabase-js holds a lock while this runs, so calling back into it deadlocks.
    supabase.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
      if (!session) {
        this.access.set('signed-out');
      }
    });
  }

  async whenReady(): Promise<void> {
    return this.ready;
  }

  async refreshAccess(): Promise<Access> {
    if (!this.session()) {
      this.access.set('signed-out');
      return 'signed-out';
    }
    const { data, error } = await supabase.rpc('is_admin');
    let access: Access;
    if (error) {
      access = isMissingFunction(error) ? 'setup-needed' : 'error';
    } else {
      access = data === true ? 'admin' : 'denied';
    }
    this.access.set(access);
    return access;
  }

  /** Resolves to an error message, or null once signed in (whether or not the account is an admin). */
  async signInWithPassword(email: string, password: string): Promise<string | null> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return /invalid login credentials/i.test(error.message) ? 'Email ou palavra-passe errados.' : error.message;
    }
    this.session.set(data.session);
    await this.refreshAccess();
    return null;
  }

  async signInWithGoogle(): Promise<string | null> {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: new URL('login', document.baseURI).href }
    });
    return error?.message ?? null;
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
    this.session.set(null);
    this.access.set('signed-out');
  }

  private async restore(): Promise<void> {
    const { data } = await supabase.auth.getSession();
    this.session.set(data.session);
    await this.refreshAccess();
  }
}
