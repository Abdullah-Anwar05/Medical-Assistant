# Progress

- 2026-11-08: Repo created. Stack decided. Module 1 = Identity login (contract: contracts/identity-v1.md). Worker sessions started.
- 2026-11-08: Identity v1 done in all three. API 31/31, web 13/13 + lint/build, mobile 20/20 + typecheck. Web and mobile flows checked against the live gateway. Pending: Docker for the PostgreSQL migration; on-device iOS run; staff sign-in path untested live.
- 2026-11-09: Pushed dad6df3 (Identity v1, all three). Paused for the Docker install and reboot. Resume: confirm Docker, start the worker sessions, run the PostgreSQL migration and API tests against the real DB, then rerun all suites.
- 2026-11-09: Identity on real PostgreSQL (Docker). API 32/32 on SQLite and on Postgres (MEDIPATH_TEST_DB=postgres), web 13/13 + lint/build, mobile 20/20 + typecheck (cold-cache Jest timeout flake fixed). Staff sign-in verified over curl, not yet clicked through in a browser (Claude in Chrome not connected). Mobile app still not run on a device.
