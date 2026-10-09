# Labawy El-Domana · لباوي الضومنة

A complete café domino league scorekeeper built with Next.js App Router,
strict TypeScript, Tailwind CSS, Drizzle ORM, and PostgreSQL. Every profile,
membership, match, lineup, round, audit event, rule snapshot, and personal photo
is stored in PostgreSQL. Browser storage contains only unsent score drafts.

Players join with a display name, optional avatar color, and optional personal
photo. They use a private link instead of email, a password, or a social account.

## Start locally

### Using PostgreSQL installed on your Mac

With Node.js, npm dependencies (`npm ci`), and PostgreSQL already installed, run:

```sh
npm run dev:local
```

This starts a dedicated PostgreSQL instance on `127.0.0.1:55432`, creates the
development and test databases, applies migrations, seeds sample data once,
and starts the app at `http://localhost:3000`. Docker is not required for this
option. Existing PostgreSQL services use their own ports and data directories.

Database files and randomly generated credentials are kept in the ignored
`.local/` directory. The command writes local connection settings to `.env`
and saves its previous contents in `.local/env.before-native` on first setup.
The owner, invitation, and recovery links are printed in your private terminal
and saved in `.local/owner-links.txt`. Keep that file private.

Run the same command again to resume; existing scores and sample data are
preserved. Ctrl+C stops the web app. To stop the project's database as well:

```sh
npm run db:local:stop
```

### Using Docker

Install **Node.js 24 LTS**, npm, and Docker with Compose. Run these commands from
this directory. `.env` is ignored by Git; `.env.example` contains placeholders.

```sh
npm ci
docker compose up -d --wait
cp .env.example .env
```

For this local Docker database, replace the contents of `.env` with:

```dotenv
DATABASE_URL=postgresql://domino:local-development-only@localhost:5432/domino_dev
DIRECT_URL=postgresql://domino:local-development-only@localhost:5432/domino_dev
TEST_DATABASE_URL=postgresql://domino:local-development-only@localhost:5432/domino_test
APP_URL=http://localhost:3000
RATE_LIMIT_SECRET=local-development-only-rate-limit-secret
```

These are development-only credentials for the included Docker service.
Do not use them on a hosted database. Then:

```sh
npm run db:migrate
npm run db:seed
npm run dev
```

Open `http://localhost:3000`. The seed prints a **local owner private link**,
a **shared invitation**, and a **separate owner recovery link**. Open the owner
private link to see the sample league, Unicode players, a completed team match,
and a live singles table. Save private links securely; do not share them in
public logs. The seed refuses production, remote hosts, and databases other than
`domino_dev`, and refuses to duplicate an existing seed. It never resets data.

For an empty league instead of sample data, skip the seed and run:

```sh
npm run owner:setup -- "Our café league" "Owner display name"
npm run dev
```

The CLI creates a new league with one owner and one season; it cannot claim or
replace an existing league's owner. League IDs printed by the CLI are stable.

Docker stores development data in a named volume. `docker compose down` stops
the service without deleting scores. The disposable test database is created
only when the volume is first initialized. For an existing volume missing it:

```sh
docker compose exec db createdb -U domino domino_test
```

## Playing and keeping score

1. The owner opens **Settings & access**, creates an invitation, and shares it.
2. Each friend opens the invitation and enters a name. Matching names do not
   authenticate an existing player. Each player has a stable ID, shown as a
   short distinguishing code. Signed-in players reuse their identity.
3. Save the private profile link shown after joining. Anyone with this private
   link can access that profile. Open it on another device to restore the same
   player. The site asks before switching a device to a different identity.
4. Select **New match**, choose 1 vs 1, 2 vs 2, three-player free-for-all, or
   four-player free-for-all, and review the displayed rules. Create and start it.
5. Enter a nonnegative whole-number score for every side, including explicit
   zero. Scores are the points your group calculated at the table. Optional
   notes can describe blocked hands or unusual events.
6. Save rounds, then finish. Totals and outcomes are calculated on the server.
   You can leave and resume an active match later.

Each player can upload or replace their photo from their own profile. Accepted
formats are still JPEG, PNG, and WebP, up to 3 MB and 25 million pixels. The server
validates the image, auto-orients it, crops it to 512×512, encodes WebP, strips
location/EXIF data, and stores at most 300 KB in PostgreSQL. Profile images are
served through an authorized endpoint, including for spectators; no storage
service or public image URLs are needed. Initials remain available without a
photo. These limits fit within the documented [Vercel function payload limit](https://vercel.com/docs/functions/limitations).

### Explicit scoring defaults

Initial defaults are **highest accumulated total wins**, **manual finish**,
**draws allowed**, and **win 3 / draw 1 / loss 0 league points**. These defaults
are configurable and do not imply a regional domino variant or a target of 100.

The owner can select highest points or lowest penalties, manual finish, a fixed
round count, or a target in highest-points mode. A target is evaluated after the
whole round is saved. If several sides cross it, their complete totals determine
the result. Ties can draw or require additional rounds. Manual finish requires at
least one non-voided round. Fixed/target completion waits for the configured
condition and tie policy. The rules and league-point policy are snapshotted when
a match **starts**, and are retained through reopening and settings changes.

In a team match, the team's domino score is stored once. Each teammate receives
one appearance and the same outcome/league points. Partners are recorded per
match and can change in future games. In free-for-all, the unique leader wins;
permitted tied leaders draw; all remaining players lose.

Standings use completed match records, ranked by league points, wins, and win
percentage. Players still tied share a rank. No raw domino-score tiebreaker is
used across incompatible rules. Reopened and voided matches are excluded.
Archived players remain in historical records.

### Permissions and corrections

- **Owner:** invitations, spectator/recovery access, members, roles, seasons,
  settings, and scorekeeping.
- **Scorekeeper:** records and corrects matches; grants scoring permission.
- **Player:** manages their profile; creates matches involving themselves;
  keeps score for matches they create. Other participants are read-only unless
  an owner or scorekeeper grants access.
- **Spectator:** views the league through a separate read-only link.

Server authorization checks membership and resource league on every protected
request. Active seats have a unique `(league, player)` constraint, backed by
transactional league locks, so concurrent starts cannot place a player at two
active tables. Multiple non-overlapping tables can run simultaneously.

Completed matches are locked. Reopen before correcting a round. Reopening
removes the match from standings until completion. Correction replaces the
saved entry and records the before/after audit. Undo marks the most recent
non-voided round void; voiding a match keeps its history. Rematches start as new,
zero-score drafts with the same lineup, in an open season.

### Saved, pending, and conflicting scores

Visible pages poll every three seconds and refresh on focus/reconnect. The UI
shows connection/last-update status. A failed request retains the draft on that
device and does not claim an offline save. Pending requests retain their UUID
idempotency key and content; retries confirm the same operation even if the
first success response was lost. Reusing a key for different content is rejected.

Match versions detect stale edits. A scorer sees the latest saved state while
their draft remains intact, and must explicitly review it before starting a new
save. Round inserts, totals, state changes, audit entries, active seats, and
idempotency records commit in a single transaction. Standings are derived from
records rather than mutable counters. Times are UTC in PostgreSQL and displayed
in the league's configurable IANA timezone (initially `Africa/Cairo`).

## Links and recovery

Three links have different purposes:

| Link | Capability | Default expiry |
| --- | --- | --- |
| Shared invitation | Join as a new player, or reuse the signed-in player | 30 days |
| Private profile | Authenticate one specific player | Valid until rotated (scoped recovery links: 10 years) |
| Read-only league | View scores without edit rights | 30 days |

Credentials are 32 cryptographically random bytes and only SHA-256 hashes are
stored. Private codes use URL fragments, which are not sent in HTTP requests.
The browser removes the fragment before inspection/redemption. Redemption uses
POST, creates a revocable database session, and sets HttpOnly/SameSite=Lax
cookies. Production cookies are Secure, host-only, and have a `__Host-` prefix.
Sessions expire after 90 days. Spectator sessions last at most seven days and
are invalid immediately if their originating link is revoked. No analytics or
request-body logging is included; referrers are suppressed.

From a player's profile, **Create / replace private link** invalidates that
profile's previous link. **Sign out other devices** revokes other sessions;
**Sign out this device** revokes the current one. Link replacement alone keeps
existing sessions usable until they are revoked.

The owner can help an ordinary player via **Members & recovery → Recover
access**. This provides a new link for that same stable player ID, restricted to
this league. It replaces previous owner-assisted links and scoped sessions.
It cannot open the player's other leagues or create owner permissions. It does
not replace the player's full personal link or revoke their full-account
sessions; a player who still has full access can manage those themselves.

### Owner recovery without email or password

Save the separate owner recovery link offline when provisioning the league.
The owner can replace it in Settings; doing so invalidates the old recovery
credential. Opening its page only previews the league. Explicit confirmation
consumes it once, revokes the owner's existing sessions, replaces their private
link, and shows a fresh recovery link. Save both replacements privately.
Invitations cannot recover or claim ownership.

If **both** the owner private and offline recovery links are lost, the deployment
operator can recover an **existing** league from a private terminal with database
credentials:

```sh
npm run owner:recover -- EXISTING_LEAGUE_UUID
```

This requires operator access to the database, is not a public web endpoint,
records an audit event, rotates access/recovery credentials, and revokes old
owner sessions. It requires no email or player password. Do not run provisioning
or recovery in public CI/deployment logs because their one-time output contains
credentials.

## Tests and production build

The included unit tests cover scoring and standings. Integration tests apply
real PostgreSQL migrations and reset **only** a dedicated database whose name
contains `test`. Browser tests use that same dedicated database and provision
isolated leagues. Do not run the integration and browser suites concurrently.
The browser runner starts its own server on port 3000; stop `npm run dev` first.

```sh
npm run typecheck
npm run lint
npm test
npm run test:integration
npx playwright install chromium
npm run test:e2e
npm run build
npm start
```

On Linux CI, install browser system dependencies with
`npx playwright install --with-deps chromium`. If Chromium is already installed,
`CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chrome npm run test:e2e` can use it.
The lockfile pins installed dependency versions. ESLint 9 is retained for the
compatible `eslint-plugin-react` peer range used by Next.js.

See [VERIFICATION.md](VERIFICATION.md) for actual commands/results and the
35–40 → reopen → 50–25 team acceptance scenario. See
[IMPLEMENTATION.md](IMPLEMENTATION.md) for the completed checklist.

The included GitHub Actions workflow assumes this project is the repository
root. In a repository containing other projects, place the workflow in the
repository's root `.github/workflows` and set its working directory and npm
cache dependency path to this project.

## Deploy on Vercel with Neon PostgreSQL

Player passwordless access is **separate** from your Vercel/Neon deployment
accounts. The deployment operator creates infrastructure and provisions the
first owner; café players only open their invitation/private links.

1. Create a [Neon](https://neon.com/) project and an empty production PostgreSQL
   database. Choose a region near your Vercel function region. Create a separate
   database/project or **empty** branch for previews. Do not clone personal
   production data into public previews.
2. In Neon's connection dialog, copy the **pooled** connection string into
   `DATABASE_URL`. Copy the direct connection string into `DIRECT_URL` for
   migrations/operator scripts. Keep the supplied TLS parameters. The app uses
   `pg`/Drizzle in the Node runtime, with a reused per-process pool capped at
   three connections, 10-second idle timeout, and connection timeout. See the
   [Neon connection instructions](https://github.com/neondatabase/website/blob/main/content/docs/get-started/connect-neon.md)
   and [Drizzle PostgreSQL guide](https://orm.drizzle.team/docs/get-started-postgresql).
3. Push the source and `package-lock.json` to a private Git repository and import
   it in Vercel. Choose Next.js, Node 24, install `npm ci`, and build
   `npm run build`. If importing a repository containing other projects, select
   this site's directory as the **Root Directory**. Do not use a static export:
   authentication and database API routes require a server. Vercel's
   [Next.js deployment guide](https://vercel.com/docs/frameworks/full-stack/nextjs)
   describes the supported deployment path.
4. Add server environment variables in Vercel:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Production Neon pooled URL with TLS |
   | `DIRECT_URL` | Production direct URL, needed by operator scripts, not browser code |
   | `APP_URL` | Your actual HTTPS Vercel/custom origin, without a trailing slash |
   | `RATE_LIMIT_SECRET` | A random secret of at least 32 characters |

   Generate a secret in a private terminal with `openssl rand -hex 32`. Mark
   values sensitive. Never prefix database/recovery secrets with `NEXT_PUBLIC_`.
   Assign preview URLs/database credentials/secrets **only** to the Preview
   environment, and production values **only** to Production. Set preview
   `APP_URL` to that preview's origin before generating preview links. Local
   development remains on Docker. `TEST_DATABASE_URL` is not a production value.
5. Before the first production release, set the same production variables in a
   private local operator terminal and run:

   ```sh
   npm ci
   npm run db:migrate
   npm run owner:setup -- "Labawy El-Domana" "Owner display name"
   ```

   Run migrations with the direct URL and only once per release in an operator
   or serialized release job. `db:migrate` applies versioned migrations;
   `db:generate` creates a new migration after schema edits. Never use a schema
   push/reset or development seed against production. The migrations include
   custom PostgreSQL score checks that must be preserved.
6. Deploy/redeploy on Vercel after setting the environment. Open the generated
   HTTPS **owner private link**, save the separate recovery link offline, review
   scoring defaults/timezone, and share only an invitation with friends. Configure
   Vercel deployment protection to suit your audience; friends must be able to
   reach the site without your operator account.
7. Test an invitation in a separate browser, save a round, restore a private
   profile on another device, and check photo upload and cross-device updates.
   Verify production cookies have Secure, HttpOnly, and SameSite=Lax attributes.

Authentication and invitations have PostgreSQL-backed, HMAC-keyed rate limits,
so limits apply across Vercel instances. Vercel's normalized `x-forwarded-for`
is used for access attempts. If self-hosting behind another proxy, configure it
to overwrite that header; do not trust arbitrary forwarded addresses. Body and
photo sizes are bounded, and links/sessions can be revoked in the app.

**Deployment status:** source is ready; no hosted database, Vercel project,
production credentials, or live URL has been fabricated or provisioned. The
remaining external steps are the Neon/Vercel setup and production migration/
first-owner commands above.

## Backups and maintenance

Back up the PostgreSQL database, including player photo bytes. Use your managed
provider's available backup/restore features and keep an independent encrypted
logical backup. Check your provider's current retention plan. From a private
operator terminal with PostgreSQL client tools:

```sh
pg_dump --format=custom --file=labawy-backup.dump "$DIRECT_URL"
```

Treat backups as sensitive: they contain names, photos, hashes, and score history.
Never commit them to Git. Restore into a **new isolated database** to test a
backup before using it for a recovery:

```sh
pg_restore --no-owner --dbname="$RESTORE_DATABASE_URL" labawy-backup.dump
```

Confirm profiles, photos, rounds, and the acceptance totals in the isolated
restore. After a real recovery, change connection variables and redeploy, then
revoke sessions/rotate access links if credentials were compromised. Keep your
operator credentials and offline owner recovery link outside the database
backup. Monitor storage because images are stored in PostgreSQL, and monitor
provider connection/query limits as the club grows.

This app is designed for a small café league: synchronization fetches league
history every three seconds while visible. Very large histories need paginated
API reads and a narrower live-match poll. It has no offline scoring queue,
regional tile/blocked-hand inference, live sockets, email delivery, or full Arabic
interface translation. Unicode names and the Arabic site name are supported;
labels and the main UI are currently English. Photos use the supported formats
above; convert HEIC phone images to JPEG first.
