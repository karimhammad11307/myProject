# Project History

## 2026-10-10 — Prepare local PostgreSQL startup and publish `master`

- Request: make the project runnable without Docker, then push the project on
  the repository.
- Changes: added `scripts/dev-local.mjs` and npm commands `dev:local` and
  `db:local:stop`; documented local PostgreSQL setup in `README.md`; retained
  the generated Next.js dev type-reference update in `next-env.d.ts`.
- Local startup creates an isolated project-owned PostgreSQL cluster and local
  development databases, applies migrations, creates development sample links
  once, and starts the Next.js development server. The existing Docker workflow
  remains documented as an option. `.env` and `.local/` are gitignored.
- Verification: `node --check scripts/dev-local.mjs`,
  `npm run dev:local -- --check`, ESLint for the startup script, and
  `git diff --check` passed. Full setup could not be verified in this managed
  workspace: PostgreSQL initialization was denied shared-memory access; the
  local web server was denied a loopback bind.
- Push state: the startup implementation and README are already on
  `origin/master` at `c96b192`. This operation added the handoff/history notes
  in the local commit; `git push origin master` failed because this
  environment could not resolve `github.com`. Push that commit from a terminal
  with GitHub network access. Remote `main` still exists and is the GitHub
  default; switch the default branch to `master` before deleting `main`.

## 2026-10-10 — Add player management and prepare the user's Vercel branch

- Request: address the Vercel deployment log, add player update/removal
  management, and put the app on the user's own repository.
- Identified the deployment target as `Abdoae35/myProject`, branch `main`, from
  the user-provided Vercel log. Its log showed a successful Next.js build and
  deployment starting; the listed Node, deprecation, and install-script
  messages were warnings. Pinned the app's Node engine to `24.x` to match its
  `.nvmrc` and remove Vercel's open-ended-major warning.
- Added league-scoped member name/avatar overrides, owner edit controls, and a
  confirmation before removing a member from the active roster. Removal
  archives the membership and preserves matches. Invitations continue to
  create player profiles. Added Drizzle migration
  `0003_same_moira_mactaggert.sql` and documented member administration.
- Verification: migration generation, TypeScript typecheck, and ESLint passed.
  The local production build could not complete because this managed workspace
  denies Turbopack's process/port operation; the supplied Vercel log did pass
  its build before these changes. No database migration was applied and no
  integration tests were run.
- Push state: added a local `personal` remote for the repository above. A push
  of the CRUD commit with `git push personal master:main` failed because this
  workspace could not resolve `github.com`. Run that command in the user's
  terminal after applying the migration to the production database with its
  private direct URL. The Vercel deployment log showed the build had passed;
  Vercel should deploy after the successful push.
