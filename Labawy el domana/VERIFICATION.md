# Verification results

The application was built and checked in the supplied workspace with Node.js
24.16.0, Next.js 16.4.0, a real local PostgreSQL 18.4 server, and Chromium.
The database was not mocked. Development and destructive test operations used
separate databases (`domino_dev` and `domino_test`).

## Commands actually run

| Command | Result |
| --- | --- |
| `npm run db:migrate` | Passed; all three versioned migrations applied to PostgreSQL. Repeated migration runs also succeeded. |
| `npm run db:seed` | Passed against the isolated local development database; sample players, a completed team match, and an active singles match persisted. |
| `npm run typecheck` | Passed; Next.js route type generation and strict TypeScript checks. |
| `npm run lint` | Passed with no findings. |
| `npm test` | **30 unit tests passed.** |
| `npm run test:integration` | **31 real PostgreSQL integration tests passed.** |
| `CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chrome npm run test:e2e` | **6 browser tests passed**, with the installed Chromium executable substituted for the placeholder. |
| `npm run build` | Passed; optimized App Router production build, including the Node.js database API. |
| `APP_URL=http://localhost:3001 npm start -- --port 3001` | Started the production build; the additional browser smoke check below passed. |

Total: **67 passing automated tests**, plus the production-runtime smoke check.
Tests were run after failures were corrected; these results describe the final
passing runs. A subsequent visual review found a desktop sidebar avatar sizing
issue. After the small CSS fix, type checking, lint, the production build, and
the production browser smoke check were repeated.

## Critical flows covered

Unit tests exercise all four lineup formats, integer/zero score validation,
highest/lowest totals, manual/fixed/target completion, draws and extra rounds,
team and free-for-all points, shared ranks, and historical rules.

Integration tests apply the real migrations and cover passwordless sessions,
second-device access, invalid/revoked/expired credentials, repeated joining,
identity switching, spectator access and revocation, one-time owner recovery,
league-scoped ordinary-player recovery, cross-league isolation, privilege
escalation, CSRF rejection, and database-backed rate limits. They also exercise
concurrent table starts, match permissions, immutable lineups, invalid scores
at API and database boundaries, idempotency, simultaneous writes, stale versions,
corrections, undo, reopening, voiding, audits, archived membership, and rule
snapshots.

Photo integration checks validate actual decoded image data, resize to 512×512
WebP, strip EXIF metadata, enforce limits, survive a database connection restart,
authorize reads, restrict writes to the signed-in player, reject corrupt/SVG
uploads, and remove photos.

Browser tests use a Pixel 7 mobile configuration and independent browser
contexts. They verify session persistence, live polling between devices, score
reloads, numeric mobile input, failed-save draft retention, retry after a lost
success response without duplicate rounds, explicit review of conflicting
drafts, Arabic names, spectator restrictions, and personal photos in profiles
and standings. Axe checks reported no WCAG 2 A/AA or WCAG 2.1 AA violations on
the tested dashboard and active/completed/voided scorecard states, including a
1440×900 desktop view. These automated checks do not replace a full manual
accessibility audit or testing every page with assistive technology.

## Exact team acceptance scenario

Both PostgreSQL integration and two-context browser tests verify:

1. Alice/Bob vs Carol/Dan: rounds **20–10** and **15–30**, totals **35–40**.
2. Manual completion with highest total and 3/1/0 league points: Carol and Dan
   each receive one appearance, one win, and 3 points; Alice and Bob each receive
   one appearance, one loss, and 0 points.
3. Reopen: the match immediately stops contributing to standings.
4. Correct the second round to **30–15**: totals become **50–25**.
5. Complete again: Alice and Bob receive the wins and 3 points; Carol and Dan
   receive losses and 0 points, with one appearance each and no leftover points
   or duplicate outcomes.

## Production-runtime smoke check

A browser signed into the optimized local production server using the seeded
owner's private link. It verified the correct profile, removal of the credential
from the address bar, the bilingual website name, authenticated database reads,
the saved **35–40** completed result, and active **12–18** scores after reload.
The session cookie was `__Host-domino` with Secure, HttpOnly, SameSite=Lax, and
path `/`. Desktop and 360-pixel mobile dashboard/scorecard screenshots were
reviewed; no horizontal overflow or browser runtime errors were found. The
desktop identity avatar was also checked to remain circular.

The smoke script, screenshots, temporary database tooling, environment files,
and private seed output are local verification artifacts and are not committed.

## Checks not performed and remaining limits

- Docker is unavailable in this environment. The supplied PostgreSQL 17 Compose
  configuration was not launched here; database checks used local PostgreSQL
  18.4 instead. The temporary database tooling is not an application dependency.
- No Neon project, hosted database, Vercel deployment, or production URL was
  provisioned. The deployment operator must create them, set the documented
  environment variables, apply migrations, and provision the first owner.
- The included GitHub Actions workflow was not run remotely. It assumes this
  project is the repository root; a parent repository needs its workflow moved
  to the root and its working directory/cache paths adjusted.
- Browser tests used Chromium. Safari, Firefox, real phones, and a full manual
  assistive-technology audit were not exercised.
- Backup/restore commands and the deployment guide are supplied; no managed
  provider backup or production recovery was performed.
- The UI is English with Arabic branding and Unicode player names. Full Arabic
  translation is not implemented. Synchronization polls every three seconds
  and is intended for a small café league; very large histories need pagination.
  Offline scores remain drafts until an explicit successful save. Still JPEG,
  PNG, and WebP photos are supported; HEIC needs conversion before upload.

Scoring assumptions are explicitly shown in the application and README:
highest total, manual finish, draws permitted, and 3/1/0 league points initially.
Points are calculated by players at the physical table; no regional domino or
blocked-hand rules are inferred.
