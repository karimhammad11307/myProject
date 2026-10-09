# Labawy El-Domana · لباوي الضومنة

A café dominoes league scorekeeper with passwordless player profiles, personal
photo uploads, live scorecards, standings, seasons, and owner management.
Built with Next.js, TypeScript, Tailwind CSS, Drizzle ORM, and PostgreSQL.

The complete application is in **[Labawy el domana](Labawy%20el%20domana/)**.

- [Local setup, playing instructions, and Vercel/Neon deployment guide](Labawy%20el%20domana/README.md)
- [Verification results and limitations](Labawy%20el%20domana/VERIFICATION.md)
- [Completed implementation checklist](Labawy%20el%20domana/IMPLEMENTATION.md)

## Getting started

Run application commands from its directory:

```sh
cd "Labawy el domana"
npm ci
```

Follow the application README to configure PostgreSQL, apply migrations, seed
local sample data or provision the first owner, and start the website.
For Vercel, set **Root Directory** to `Labawy el domana`.

All four match formats are supported: singles, two-player teams, and three- or
four-player free-for-all. Scores and personal photos persist in PostgreSQL.
Players use private access links instead of email addresses and passwords.

Created by Karim Hammad.
