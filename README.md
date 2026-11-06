# EuroPetStay

EuroPetStay connects pet owners with travellers who care for pets in exchange for a free stay. The app uses React, Vite, TypeScript, Supabase Auth, Postgres, and Realtime.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set your Supabase project URL and publishable key. Never put a database password or Supabase service-role key in the browser app.
3. Apply all SQL files in `supabase/migrations` in timestamp order in the Supabase Dashboard's **SQL Editor**, or link the Supabase CLI to your project and run `supabase db push`. The latest migration creates the listing photo bucket and its access policies; it must be applied to the same Supabase project configured in `.env.local`.
4. In Supabase **Authentication → URL Configuration**, set the local site URL to `http://localhost:5173` and add it to the allowed redirect URLs. Add the deployed site URL before deploying.
5. To use email sign-in links, enable the Email provider. The app emails a secure link and creates an account automatically on the first successful sign-in. Keep the Supabase **Authentication → Email Templates → Magic Link** template configured to include `{{ .ConfirmationURL }}`; [`supabase/templates/magic_link.html`](./supabase/templates/magic_link.html) is an optional example. Configure SMTP for reliable delivery; the built-in email service is rate limited.
6. To use Google sign-in, allow new users to sign up in Supabase Auth and create a **Web application OAuth client** in Google Cloud. Add the exact Supabase callback URL shown on the Supabase Google provider page to the OAuth client's authorized redirect URIs. Use the OAuth client ID (usually ending in `.apps.googleusercontent.com`), not a Google account name or project name. Put the Google **client ID** and **client secret** in Supabase's Google provider settings; do not put either secret in `.env.local` or frontend code. Supabase creates the auth user on the first successful sign-in, and the database trigger in the initial migration creates the matching EuroPetStay profile.
7. Start the app using `npm run dev`.

The migrations create profiles, listings, conversations, and messages; create the public `listing-photos` bucket with owner-only upload/delete policies (up to 5 MB per JPEG, PNG, WebP, or AVIF); apply row-level security; and add messages to the `supabase_realtime` publication. Listing forms accept up to six image files and upload them directly to that bucket. No demo listings or accounts are seeded.

## Checks

- `npm run build`
- `npm run lint`

## Project layout

```text
src/
  app/                 App shell and page styles
  features/
    auth/              Supabase email magic links, Google OAuth, session provider
    chat/              Inbox and listing-linked realtime messages
    listings/          Listing cards and listing creation
  i18n/                English, French, and German translations
  lib/                 Supabase client
  types/               Database row and client types
  main.tsx             Application entry point
  index.css            Global styles
supabase/
  migrations/          Database schema, RLS policies, and Realtime setup
```
