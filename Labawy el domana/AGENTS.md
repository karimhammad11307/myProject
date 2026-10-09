<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Current handoff

The local Mac PostgreSQL startup workflow is in `scripts/dev-local.mjs`, with
usage documented in `README.md`. Local database state, connection settings, and
owner links stay ignored under `.local/` and `.env`. The workspace's sandbox
blocks PostgreSQL shared-memory initialization and local web-server binding;
finish setup in a normal user terminal with `npm run dev:local`. The startup
implementation is on the friend's `origin/master`. The user's Vercel log
identifies `Abdoae35/myProject` and deploys `main`; push current local `master`
to that repository's `main` using `git push personal master:main`. The player
CRUD is committed locally, but this workspace cannot resolve GitHub, so push
from the user's terminal. Apply its Drizzle migration to production with the
private production `DIRECT_URL` before deploying the updated app. See
`PROJECT_HISTORY.md` for details.
