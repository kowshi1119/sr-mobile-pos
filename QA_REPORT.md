# Desktop QA report

## v1.1.1 — 2026-09-28 (developer PC, Windows 10 Pro, 1366×768 at 100%)

**Status: TEST CANDIDATE. Not production-approved.** The required release gates marked NOT RUN below have not been done.

Test data was always a fresh temporary profile; no real shop data was used.

**Input methods used:**
- **OS input:** real Windows keyboard and mouse via `SendInput`. Only possible while the PC was unlocked.
- **Chromium input:** real input events through Chromium's pipeline (`sendInputEvent`). Used while the PC was locked.
- Field values were never set with JavaScript.

**Screen size:** the "1366×768" window is really 1350×663 of page area on this PC (taskbar and title bar take the rest). The 1920×1080 runs could not grow beyond the screen.

| Area | Test | Result | Evidence |
|---|---|---|---|
| Customer bug | Reproduce on 1.1.0 (OS input, installed 1.1.0 code) | **Reproduced** | Tap on Phone hit the Scan Product button; the camera opened then closed; nothing typed |
| Customer bug | Reproduce native-dialog typing loss on 1.1.0 (OS input) | **Reproduced** | After a native confirm, typing "Charger" left the field empty; minimise/restore worked around it |
| Customer bug | Regression suite on unmodified 1.1.0 screens (Chromium input) | Fails as expected (14/25) | Covered fields, discount "0", no in-app dialogs |
| Typing suite | Packaged 1.1.1, OS input, first run | **PASS 25/25** | All forms, full keyboard checklist, clipboard, minimise/restore, dialogs |
| Typing suite | Packaged 1.1.1, Chromium input | PASS 24/25, 1 BLOCKED | Clipboard unavailable while the PC was locked |
| Typing suite | Later OS-input reruns | Inconsistent (23/25) | Traced to the test helper: an Alt tap opened the menu bar, and clicks were measured mid-scroll. The helper was fixed, but the final rerun was stopped at the owner's request, so it is **NOT RUN after the fix** |
| New Sale suite | Packaged 1.1.1, Chromium input | **PASS 8/8** | One sale per double-click / double F12; decimal credit sale; discount totals; card/transfer; sequential invoices; stock; offline WhatsApp notice |
| New Sale suite | OS input | Inconsistent (same helper cause) | WhatsApp checkbox confirmed to work with real clicks in a focused probe (2 of 3 clicks toggled it; the miss was mid-scroll) |
| Unit/integration | `npm test` | **PASS 34/34** | Includes new data-safety tests and the no-native-dialog guard |
| Existing UI smoke | Source and packaged code | PASS | Owner setup, category/product via UI, cashier restrictions, single instance, no passwords in log |
| Packaged exe | `--diagnostic-smoke` | PASS | Setup, login, category, product, sale (stock 5→4), staff login, staff blocked (403) |
| Package contents | `scan-package.js` | PASS | Frontend, both migrations and the DB client present; no .env, databases, tests or secret patterns |
| Security | nodeIntegration off, contextIsolation on, sandbox on | PASS | Smoke and diagnostic assertions |
| Dependencies | `npm audit` (root, frontend, backend) | PASS | 0 known vulnerabilities on 2026-09-28 |
| Web build | `npm run build:web` | PASS | Compiles |
| Backups | Newer-version backup rejected, fake/renamed file rejected | PASS | data-safety.test.js |
| Money | Negative, >2 decimals, huge amounts refused; exact 0.10/0.20 totals through sale → debt → payment → dashboard | PASS | data-safety.test.js, integration.test.js |
| Offline | External requests blocked inside the app | PASS (simulated) | Smoke test and offline WhatsApp sale |
| Offline | Network cable physically unplugged | NOT RUN | |
| Installer | Fresh install from the extracted ZIP, shortcuts, uninstall | NOT RUN | Stopped at the owner's request |
| Upgrade | Installing 1.1.1 over 1.1.0 with QA data | NOT RUN | Stopped at the owner's request |
| Customer PC | Confirm the fix on the customer's PC | NOT RUN | |
| Hardware | Receipt/label printing, barcode scanner device, camera | NOT RUN | |
| Code signing | Authenticode | NotSigned | SmartScreen may warn |

Observations (not changed in 1.1.1):
- The window still has Electron's default menu bar (File/Edit/View/Window). Its View menu offers Reload and Toggle Developer Tools. Permissions are enforced by the server, but hiding this menu for a shop POS is recommended.
- Percent discounts round the discount to whole rupees (10% of 1,499.50 → 150), as before.
- Electron 44.4.3 still contains the upstream native-dialog bug; the app no longer uses native dialogs. Update Electron when a 44.x release includes electron/electron#54452.


## v1.1.0 — 2026-09-24 (developer Windows 10 x64 host)

Passed:
- npm test: 27/27. Includes the original lifecycle suite plus a new v1.1 suite: v1.0 database + settings admin upgraded to OWNER (same password), pre-migration snapshot only when migrations are pending, saved port reused across restarts and replaced when taken, readable 4xx messages (blank/invalid prices, missing category, duplicate barcode, insufficient stock), api-rejected log entries without passwords, owner creating a Cashier, staff denied product create / price / stock / delete / categories / users / dashboard / analytics / expenses / suppliers / export / reset / import / discounts / checkout price change, cost price hidden, bundle-price exception, loyalty-only redemption, live permission grant, disable and password reset ending sessions, owner account protected, export excluding logins, reset keeping them, restoring a v1.0 backup keeps the owner able to sign in.
- Electron UI smoke test (npm run test:desktop), passed on the last 3 runs (earlier runs failed on a screenshot-capture flake and on the IMEI-summary pop-up that blocked the page; both fixed): owner setup form (including password mismatch message), category guidance banner, missing-category and missing-price messages, inline category creation, product saved with blank cost price, staff creation with Cashier preset, all 13 owner pages rendered in dark and light mode, cashier sign-in landing on New Sale with only New Sale/Products/Customers/Repairs in the menu, discount and Add Product hidden, /users redirected, second instance exits, log contains no passwords. Light-mode screenshots were reviewed by eye (dashboard, analytics, billing, products, product form, users, add-staff form, data & backup, login, cashier views).
- Web frontend build (npm run build:web) and desktop build (npm run desktop:prepare) compile.
- NSIS installer built: release/SR-Mobile-POS-Setup-1.1.0.exe, SHA-256 93FDBF3ECB390DAEF860436A55C6E3CF3762CC82F283561B2B6A3218EB03CDB4. Authenticode status: NotSigned.
- Packaged executable --diagnostic-smoke: owner setup, login, category, product with blank cost, sale (stock 5 -> 4), staff login, staff product create denied (403), dashboard.
- Upgrade dry run on a copy of this PC's real v1.0 profile: migration 002 applied, pre-migration backup created, existing admin login became the OWNER with an identical password hash.

Not tested in v1.1.0:
- Installing the 1.1.0 installer over the running 1.0.0 installation on this PC (left for the owner to do after a backup), clean-machine install, printers/scanners, live WhatsApp/Groq/Cloudinary, the web deployment against PostgreSQL with the new User table.

## v1.0.0 — 2026-09-22

Validation performed on the developer Windows 10 x64 host, 2026-09-22. This is a tested release candidate, not a claim of completed client-site acceptance.

## Passed
- Reproducible npm ci from root, including frontend installation.
- Web frontend production build and desktop frontend production build.
- Original PostgreSQL schema validation and separate SQLite schema validation.
- 15 Node test results (parent plus 14 subtests): loopback capability/origin/JWT restrictions; setup/password/login; categories/products/edit/search; sale decimal totals/stock/invoice/credit; repeated manual debt decimal increments/payment; rejection/transaction rollback; repairs/reports/offline AI; variants/IMEI/warranty/loyalty/optional WhatsApp failure/supplier purchases/expenses/targets/bundles; local uploads/SVG rejection; JSON import/export/counter preservation; snapshots/retention/invalid restore; close/reopen persistence; restore/safety backup; invalid enum/schema-tampering rejection.
- Actual Electron smoke test: sandbox enabled, Node integration disabled, context isolation enabled, narrow preload bridge, first setup/login, local API, bundled fonts and dashboard with external renderer requests blocked.
- Second Electron instance exited without a conflicting instance. Main application routes rendered: dashboard, products, categories, billing, customers, repairs, notifications, analytics, suppliers, expenses, bundles and data.
- Packaged Electron executable diagnostic: first launch database initialization, administrator setup/login, authenticated products API, dashboard and graceful shutdown.
- NSIS installer execution in a dedicated task QA folder; installed executable, desktop shortcut, Start Menu shortcut, Add/Remove Programs entry (SR Mobile POS 1.0.0).
- Installed executable diagnostic using a new temporary profile.
- Silent uninstall; executable, desktop shortcut, Start Menu shortcut and uninstall registration removed. Test installation cleaned up.
- npm audit: zero reported vulnerabilities in desktop root, standalone backend and frontend after targeted updates. This does not certify absence of all security defects.
- Git diff whitespace check after cleanup.

## What these tests do not establish
- This host already has developer tools; no clean Windows VM/client-PC installation has been performed.
- Network requests were blocked at the Electron session boundary and optional credentials were absent; no physical cable/Wi-Fi disconnection was performed.
- Existing-database migration/reopen was tested. A real newer-version installer over an older installation and a deliberately interrupted migration/restore were not yet tested.
- Backup/restore core routines were tested; native file-dialog interaction was not automated end-to-end.
- Real receipt/thermal printer, barcode scanner and camera hardware were not tested.
- Live Groq/Meta delivery and Cloudinary web upload need valid rotated credentials and service acceptance testing.
- PostgreSQL schema and web compilation passed; cloud production behavior was not tested against a live PostgreSQL database.
- Financial fields are normalized to two decimals; SQLite NUMERIC affinity is not arbitrary-precision fixed-scale storage. Existing reports still round some presentation values to whole rupees and use current product cost for historical summaries. Reconcile real shop totals before go-live.
- Existing supplier stock updates and separate loyalty redemption behavior deserve additional business-rule regression testing before production acceptance.

## Dependency remediation
Removed unused vulnerable UUID dependency. Updated Cloudinary and Multer for their identified advisories, Express/qs to patched compatible versions, Vite to 6.4.3 and React Router to pinned 7.18.4. React Router retains the declarative APIs used here; build and native-route regressions passed. No blanket npm audit fix --force was used.

## Security and release gates
Removed the tracked backend/hash.txt, documented default password, Groq-style key and credential-bearing PostgreSQL URL from current source. Rotate the Groq key, database credentials and any reused administrator password. Git history still contains prior values; no history rewrite was performed. Current-source pattern scanning is recorded in SECRET_SCAN.json and must not be treated as a complete secret-audit guarantee.

Installer is unsigned (Authenticode status NotSigned). A real shop icon and legal publisher metadata still need to be supplied. Complete RELEASE_CHECKLIST.md, clean-machine/upgrade testing and hardware acceptance before a production release. No GitHub release is automatically published by the workflow.
