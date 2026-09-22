# Desktop QA report

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
