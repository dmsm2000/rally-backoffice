import { createClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';

// The publishable anon key, like Rally itself. Admin access is decided in SQL (is_admin()), never by
// holding a more powerful key in the browser.
export const supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
  auth: { storageKey: 'rally-backoffice-auth' }
});
