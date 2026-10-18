# Build log

| ID | date | state | missing | harder than expected |
| --- | --- | --- | --- | --- |
| S01 login + first-run setup | 2026-10-18 | done | password reset (owner can be reset in the DB for now) | — |
| S02/S03 Today (route of the day) | 2026-10-18 | partial | drive time between stops, route optimization (needs Google key, marco 2d) | — |
| S04 calendar | 2026-10-18 | partial | hour grid, drag to reschedule, month view | — |
| S05 new appointment | 2026-10-18 | done | recurring series (S07), slot suggestions | React 19 resets forms after submit; added ActionForm |
| S06 appointment detail | 2026-10-18 | done | SMS on status change (marco 2c) | — |
| S09–S11 clients and pets | 2026-10-18 | done | vaccines (S12), pet codes, photo | — |
| S13 checkout | 2026-10-18 | done | receipt by text | tip-only payments needed a schema change |
| S17/S18 settings: services, hours, business | 2026-10-18 | done | logo, time off, van start address | — |

Verified by `npm run test:e2e` on a fresh database at 390px: setup → client → pet → book
($194) → double booking refused → Today + Google Maps route → status flow → Venmo + 20% tip → paid.
Screenshots in `replica/clone-screens/`.
