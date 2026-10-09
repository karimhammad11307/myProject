# Implementation checklist

- [x] Database schema, migrations, isolated seed and local PostgreSQL setup
- [x] Private access, sessions, invitation/view links, ownership and recovery
- [x] All formats, scoring policies, audit, concurrency and idempotency
- [x] Live café UI, profiles, standings, history and owner management
- [x] Labawy El-Domana / لباوي الضومنة branding and personal photo uploads
- [x] Unit, real PostgreSQL integration and two-context mobile browser tests
- [x] Type checking, lint, production build and Vercel/backup documentation

Assumptions: points are calculated at the table. Default rules are highest-total,
manual finish, draws allowed, win/draw/loss 3/1/0. No regional variant is inferred.
The deployment operator provisions the first owner by CLI; ordinary players only
need a name and an invitation. Neon is the managed PostgreSQL option.

Verification: 30 unit tests, 31 PostgreSQL integration tests, and 6 browser tests
passed. The production build and a local production-runtime smoke check passed.
See [VERIFICATION.md](VERIFICATION.md) for the evidence and checks not performed.
External Neon/Vercel provisioning remains with the deployment operator; complete
instructions are in [README.md](README.md).
