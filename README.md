# EuroPetStay

EuroPetStay connects pet owners with travellers who care for pets in exchange for a free stay. The app uses React, Vite, TypeScript, Supabase Auth, Postgres, and Realtime.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set your Supabase project URL and publishable key. Never put a database password or Supabase service-role key in the browser app.
3. Apply all SQL files in `supabase/migrations` in timestamp order in the Supabase Dashboard's **SQL Editor**, or link the Supabase CLI to your project and run `supabase db push`. The latest migrations add the structured `need_sitter` and `offer_sitting` post types, lifecycle statuses, private care and sitter-verification data, review aggregates, and conversation read markers; apply them to the same Supabase project configured in `.env.local`.
4. In Supabase **Authentication → URL Configuration**, set the local site URL to `http://localhost:5173` and add it to the allowed redirect URLs. Add the deployed site URL before deploying.
5. To use email OTP sign-in, enable the Email provider and set Supabase **Authentication → Email Templates → Magic Link** to use `{{ .Token }}` (not `{{ .ConfirmationURL }}`). [`supabase/templates/magic_link.html`](./supabase/templates/magic_link.html) is the six-digit code template. The app verifies the code in place and creates an account automatically on first sign-in. Configure SMTP for reliable delivery; the built-in email service is rate limited.
6. To use Google sign-in, allow new users to sign up in Supabase Auth and create a **Web application OAuth client** in Google Cloud. Add the exact Supabase callback URL shown on the Supabase Google provider page to the OAuth client's authorized redirect URIs. Use the OAuth client ID (usually ending in `.apps.googleusercontent.com`), not a Google account name or project name. Put the Google **client ID** and **client secret** in Supabase's Google provider settings; do not put either secret in `.env.local` or frontend code. Supabase creates the auth user on the first successful sign-in, and the database trigger in the initial migration creates the matching EuroPetStay profile.
7. Start the app using `npm run dev`.

The migrations create profiles, structured home-care and sitter-offer listings, conversations, messages, reviews, and private safety tables. Public listing photos use the `listing-photos` bucket (up to 5 MB per JPEG, PNG, WebP, or AVIF); sitter ID documents use a separate private bucket with owner-only storage policies (up to 10 MB per JPEG, PNG, or PDF). Veterinary and emergency contacts, ID documents, and reference contacts are not shown on public listing cards. Conversation participants can see the care plan in their in-app chat. The app does not currently review ID submissions or provide insurance; an uploaded ID does not imply verification. Apply all migrations before testing. No demo listings or accounts are seeded; test owner and sitter flows with separate accounts.

## Checks

- `npm run build`
- `npm run lint`

## Project layout

```text
src/
  app/                 App shell and page styles
  features/
    auth/              Supabase email OTP, Google OAuth, session provider
    chat/              Inbox and listing-linked realtime messages
    listings/          Structured posts, cards, and My Posts
  i18n/                English, French, and German translations
  lib/                 Supabase client
  types/               Database row and client types
  main.tsx             Application entry point
  index.css            Global styles
supabase/
  migrations/          Database schema, RLS policies, and Realtime setup
public/
  trust-safety.html    Static trust, safety, and service-limitations page
```
