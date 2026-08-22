# ConnectFlow

Connect-group management for a church: track members, the leaders they sit
under, and their journey from first contact through induction.

The project is `connectflow`; the app presents itself to users as **ENC Wits**.
That display name lives in `src/lib/app.ts` — change it there and it changes
everywhere it appears.

A **connect** is a small group. A **member** who has people sitting under them
*is* a connect leader — there is no separate leaders table. The whole structure
is one self-referencing tree.

> **Status: early.** Authentication, the members page and CSV import work
> end-to-end. Matching, induction tracking, the review queue, WhatsApp
> confirmations and the intake webhook are not built yet — the sidebar shows
> them greyed out.

---

## Stack

| | |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) (React 19 + Vite), file-based routing, SSR |
| Data | TanStack Query (server state) · TanStack Store (client state) · TanStack Table v9 |
| Database | Neon Postgres via Drizzle ORM |
| Auth | [Better Auth](https://better-auth.com) with the `admin` plugin |
| UI | shadcn/ui + Tailwind v4 · lucide-react icons |
| Validation | Zod |
| Tests | Vitest |
| Hosting | Cloudflare Workers |

---

## Getting started

**Prerequisites:** Node 22+, pnpm 10+.

```bash
pnpm install
cp .env.example .env.local
```

Fill in `.env.local`:

```bash
# generate a secret
pnpm dlx @better-auth/cli secret
```

Leave `DATABASE_URL` blank and `pnpm dev` will provision a free, claimable Neon
database for you — note those expire after 72 hours. For anything you want to
keep, create a database at [neon.tech](https://neon.tech) and paste its
connection string in.

```bash
pnpm db:migrate    # create the tables
pnpm dev           # http://localhost:3000
```

### Creating the first admin

There is **no public sign-up** — accounts are created by an admin. That leaves a
chicken-and-egg problem for the very first one, so it has to be made by hand:

1. Start the app and create a user through the API:

   ```bash
   curl -X POST http://localhost:3000/api/auth/sign-up/email \
     -H 'Content-Type: application/json' \
     -H 'Origin: http://localhost:3000' \
     -d '{"name":"Your Name","email":"you@example.com","password":"a-long-password"}'
   ```

2. Promote that account to admin:

   ```sql
   update "user" set role = 'admin' where email = 'you@example.com';
   ```

Every account after this one is created from the dashboard, which generates a
temporary password and shows it once.

---

## How the domain fits together

### Members are leaders

`members.leaderId` points at another **member** row. So:

- The **Connect Leader** column is a self-join on that column.
- The **Leader** badge means *someone sits under you* — it is about position in
  the tree, not about your login permissions.
- Deleting a member who leads people is refused, with a message telling you to
  reassign them first. Nothing is ever cascade-deleted or silently orphaned.

A leader's login account is tied to their member row through `members.userId`.
That link is what scopes what they can see.

### Who can see what

| | Admin | Leader |
|---|---|---|
| Members table | everyone | only members directly under them |
| Stats cards | whole system | scoped to their own group |
| Import CSV | yes | button hidden |
| Delete a member | yes | no |

Scoping is **not recursive** — a leader sees the people directly under them, not
their sub-leaders' people. A leader account with no linked member row sees
nothing at all.

All of this is enforced server-side in every `action.ts`. Hidden buttons are a
convenience, never the access control: calling an action directly with a
leader's session is rejected.

---

## Importing members from CSV

Admins can import the connect-database spreadsheet export from the members page.

```csv
Name and Surname Of Leader,Connect Members
Pastor Ada Lovelace,Grace Hopper
,Alan Turing
Grace Hopper,Katherine Johnson
```

- **The leader column is forward-filled.** A blank cell inherits the leader
  above it, which is how these sheets are normally laid out.
- **Group suffixes are stripped.** `Grace Hopper - Group A`, `Grace Hopper
  (Group B)` and `Grace Hopper GRP 3` all resolve to `Grace Hopper`.
- **Leaders who aren't listed as members get created.** The person at the top of
  the tree usually only ever appears in the leader column. They're added as a
  member and reported back to you, not guessed at silently.
- **A name matching two members halts the entire import.** Nothing is written,
  the transaction rolls back, and the ambiguous names come back for review —
  attaching a whole group to the wrong person is silent and very hard to spot
  afterwards.

Other column headings (`Name`, `Full Name`, `Phone`, `Email`, `Residence`,
`Course`, …) are recognised too; see `HEADER_ALIASES` in
`src/features/members/import-csv/parse-csv.ts` to add more.

---

## Commands

```bash
pnpm dev              # dev server on :3000
pnpm build            # production build
pnpm deploy           # build + wrangler deploy

pnpm test             # vitest run
pnpm test:watch       # vitest

pnpm check            # biome lint + format (run before finishing work)
pnpm exec tsc --noEmit  # typecheck — there is no typecheck script

pnpm db:generate      # generate SQL migrations from the schema
pnpm db:migrate       # apply them
pnpm db:push          # push schema straight to the DB (dev shortcut)
pnpm db:studio        # drizzle studio

pnpm dlx shadcn@latest add <component>
```

### Tests

`*.test.ts` are pure and always run. `*.integration.test.ts` hit the real
`DATABASE_URL` and skip when it is unset — they namespace their fixtures and
clean up after themselves, but they do write to the database, so point
`DATABASE_URL` at a development one.

---

## Project layout

```
src/
├── routes/              # file-based routes; these hold no logic
│   ├── index.tsx        # login — the landing page, and the only public route
│   ├── _authed.tsx      # auth guard + dashboard shell (sidebar, inset)
│   ├── _authed/
│   │   ├── dashboard.tsx
│   │   └── members/
│   └── api/auth/$.ts    # better-auth handler
├── features/            # business logic, one folder per user action
│   ├── auth/sign-in/
│   ├── users/{create-user,list-users,stats}/
│   └── members/{member-list,member-stats,delete-member,import-csv}/
├── components/
│   ├── ui/              # shadcn/ui — added via CLI, not hand-written
│   └── layout/
├── db/schema/           # drizzle tables, one file per table
└── lib/                 # auth, permissions, utils
```

A form-backed feature holds `schema.ts`, `schema.test.ts`, `action.ts`,
`Form.tsx`, `index.ts`. A read feature holds `action.ts`, `query.ts`,
`index.ts`. Routes import from `features/` and render.

---

## Deployment

Cloudflare Workers via Wrangler. Set secrets before the first deploy:

```bash
wrangler secret put DATABASE_URL
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put BETTER_AUTH_URL   # must be the deployed origin, or cookies break
pnpm deploy
```

> **Don't swap the database driver to `drizzle-orm/node-postgres`.** SSR runs on
> workerd in both `pnpm dev` and production, and workerd has no raw TCP — the
> `pg` driver hangs rather than erroring, which is a miserable afternoon. The
> app uses Neon's WebSocket pool with `neonConfig.poolQueryViaFetch = true`.

---

## Known gaps

- No transactional email, so password reset and email verification are off. The
  "Forgot your password?" link is inert, and new users get a generated password
  handed to them directly.
- No OAuth providers configured.
- The members table's **View** action and **Add Member** button are placeholders
  — there's no member detail page or manual-create form yet.
- Every imported member shows a quiet **Incomplete** profile badge until gender,
  residence and field of study are backfilled. That's expected, not an error.
