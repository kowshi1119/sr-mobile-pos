# Developer release checklist

- [ ] Version and lockfile updated
- [ ] Approved multi-resolution icon.ico configured
- [ ] Publisher metadata reviewed
- [ ] npm ci succeeds on clean checkout
- [ ] PostgreSQL schema and existing web build preserved
- [ ] SQLite Prisma client generated
- [ ] Unit/integration tests pass
- [ ] Actual packaged executable diagnostic passes
- [ ] Windows NSIS installer builds
- [ ] Installer SHA256 recorded
- [ ] Clean Windows machine installation tested without Node/PostgreSQL
- [ ] Desktop and Start Menu shortcuts tested
- [ ] Add/Remove Programs and uninstall tested
- [ ] First owner setup and invalid login tested
- [ ] v1.0 admin login works after upgrading (becomes the owner)
- [ ] Staff login created; Cashier preset limits menu and actions; price/stock/discount/cost restrictions checked
- [ ] Permission change, disable and password reset apply without the staff member signing out
- [ ] Light and dark mode checked on every page
- [ ] Products, variants, stock, IMEI, customers and sales tested
- [ ] Repairs, debt, loyalty, suppliers, expenses and reports reconciled
- [ ] Offline operation tested with physical network disconnected
- [ ] WhatsApp/AI failure and configured service delivery tested
- [ ] Receipt and label printing tested on client's hardware
- [ ] Restart persistence tested
- [ ] Automatic/manual backups and retention tested
- [ ] Native restore dialog, corrupt/newer backup rejection and safety copy tested
- [ ] Interrupted restore and migration failure recovery tested
- [ ] Second-instance focus behavior tested
- [ ] A newer-version installer over an older installation preserves all user data
- [ ] Exposed historical credentials rotated
- [ ] Dependency audit reviewed (currently zero known vulnerabilities)
- [ ] Signing certificate configured, or unsigned status disclosed honestly
- [ ] Installer checked on clean machine and release notes approved
- [ ] GitHub release prepared manually with installer and checksum

Do not check a box merely because an implementation exists. See QA_REPORT.md for tests actually performed.
