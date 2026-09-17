// Copy to environment.ts (gitignored) and fill in. Same Supabase project as Rally, same publishable
// anon key — never a service-role key: every admin read and write is checked by is_admin() in SQL.
export const environment = {
  supabaseUrl: 'https://<project-ref>.supabase.co',
  supabaseAnonKey: '<publishable anon key>',
  // Where "Ver na app" links point. No trailing slash.
  rallyAppUrl: 'https://dmsm2000.github.io/rally'
};
