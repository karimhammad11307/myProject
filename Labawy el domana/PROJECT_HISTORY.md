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
