# Rally Backoffice

Moderation tool for Rally, used by one person. Angular 22 + Tailwind v4, talking to the **same
Supabase project as the Rally app** with the same publishable anon key. There is no privileged key
anywhere in here: every read and write is a `security definer` RPC that checks `public.is_admin()`
in SQL first, so a non-admin who opens this app gets nothing.

## Pages

- **Dashboard** — what needs attention (open reports, abandoned drafts), report reasons, community
  numbers, recent actions.
- **Court reports** — reports grouped per court. Ignore / mark as handled (closes every open
  report on that court at once), delete the court (deleting a venue's last court deletes the venue
  too), delete the whole venue.
- **Post reports** — reports grouped per post. Ignore / mark as handled / delete the post
  (its photo or video is removed from Storage too).
- **Players** — every account with a profile. Edit name, bio and location; block (Supabase Auth
  ban — they can't sign in, their content stays) or unblock; delete the account.
- **Posts** — every post, including automatic announcements. Create (as your own Rally
  profile), edit text/type, delete.
- **Matches** — edit date/time/place/note, cancel, correct a finished singles result, delete.
- **Trips** — edit destination/dates/description, delete.
- **Venues** — every venue including drafts, with the GPS accuracy it was registered with. Filter
  "Old drafts" lists drafts unconfirmed for 60+ days, with a bulk delete. Create a venue (born
  verified), and on each venue's page edit it, verify a draft, and add/edit/delete courts and photos.
- **Waitlist** — the landing page's waitlist: add, remove, export CSV.
- **Activity** — every action taken, with a snapshot of what it affected (deleting a post or court
  cascades its reports away, so this is the only record left).

## Setup

1. Apply `rally-supabase/migrations/0045_backoffice_moderation.sql` and then `0046_backoffice_crud.sql` in the
   Supabase SQL Editor.
2. Make your Rally account an admin (same SQL Editor):

   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'your-email@example.com';
   ```

3. Create `src/environments/environment.ts` (gitignored):

   ```ts
   export const environment = {
     supabaseUrl: 'https://xxxxx.supabase.co',
     supabaseAnonKey: '...',
     rallyAppUrl: 'https://rally-teal-three.vercel.app/'
   };
   ```

   Use the same Supabase URL and anon key as Rally.
4. `npm install`, then `npm start` → http://localhost:4300

Sign in with the same email/password as in Rally.

## Commands

```bash
npm start       # dev server on :4300
npm run build   # production build into dist/
```

## Deployment

Pushing to `master` runs `.github/workflows/deploy-pages.yml`, which builds the app and deploys it to
GitHub Pages. It generates `environment.ts` from the repo's `SUPABASE_URL` and `SUPABASE_ANON_KEY`
secrets (Settings → Secrets and variables → Actions) — these must be added here even though the
values are the same as `rally`'s. GitHub Pages must be enabled once (Settings → Pages → Source:
GitHub Actions).
