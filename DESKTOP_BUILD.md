# SR Mobile POS desktop build

## Status and architecture
Windows x64 Electron application: packaged React/Vite assets -> loopback Express on an OS-assigned port -> one Prisma client -> SQLite. Electron supplies Node; clients install no development tools. The cloud PostgreSQL schema and backend entry point remain available.

Use Windows 10/11 x64 and Node 24 LTS on the developer machine. Keep the repository lockfiles. From the repository root:

~~~powershell
npm ci
npm run desktop:prepare
npm test
npm run test:desktop
npm run desktop:dev
npm run desktop:build
~~~

Root installation also runs npm ci for the frontend. desktop:prepare generates the SQLite Prisma client and builds the production frontend. desktop:dev uses that production frontend; no Vite server is needed. desktop:build repeats preparation and builds NSIS without publishing.

Installer: release/SR-Mobile-POS-Setup-1.0.0.exe
Unpacked executable: release/win-unpacked/SR Mobile POS.exe

For an isolated packaged runtime smoke check:

~~~powershell
& '.\release\win-unpacked\SR Mobile POS.exe' --diagnostic-smoke
~~~

This creates a NEW temporary sr-pos-packaged-* profile, performs setup/login/local API/dashboard assertions with external renderer requests blocked, logs the result under that profile's logs/diagnostic.json, then shuts down. It never opens the normal shop database.

## User data
The runtime uses app.getPath('userData') with application name SR Mobile POS. Normally:

~~~text
%APPDATA%/SR Mobile POS/
  data/pos.db
  backups/*.db
  uploads/*
  exports/
  logs/desktop.log
  settings/security.json
  settings/integrations.json (optional)
~~~

Data is outside the installation directory and survives upgrades and ordinary uninstall. The local admin email/hash and a random 512-bit JWT secret live in security.json; there is no production default password. Windows account permissions protect this folder; the database itself is not encrypted. Lock the Windows account and protect backups. Each dynamic-port launch uses a new origin, so expect to sign in again after restart.

## Migrations and money
The web schema remains backend/prisma/schema.prisma (PostgreSQL). Desktop uses backend/prisma/desktop/schema.prisma with a separate generated client. All 23 business models and relationships remain. PostgreSQL enums become SQLite TEXT with CHECK constraints. Native @db.Decimal annotations are removed. Desktop monetary Float fields are promoted to Prisma Decimal; purchase quantity remains Float. Sales use Decimal arithmetic, two-decimal monetary values and the original maximum 99,999,999.99. SQLite NUMERIC affinity is not exact fixed-scale storage: do not treat this as arbitrary-precision accounting; write normalization and decimal arithmetic are required. Existing report presentation rounds many totals to whole rupees, as before.

Versioned SQL lives in backend/prisma/desktop/migrations. The runtime stores SHA-256 checksums in _DesktopMigration, rejects unknown/newer or edited migration histories, backs up an existing database, and runs pending SQL in a transaction with foreign-key checks. First initialization uses a staging database. Never edit a released migration: add the next numbered SQL migration, update the desktop schema, generate the client, and test old-to-new upgrades. No Prisma CLI or development tools run on the client.

To bring cloud data to desktop: use the existing web JSON export, initialize the desktop account, then Data & Backup -> Import JSON Backup. Take backups first. Unique-field conflicts abort the import; duplicate IDs are skipped. Invoice numbering is advanced beyond imported invoices. Compare record counts and financial totals before switching the shop. Cloud image URLs need re-uploading locally for offline availability. Desktop-to-web conversion is not an automatic sync feature.

## Backups and restore
Consistent SQLite snapshots use VACUUM INTO, including committed WAL data. Backups run at startup, every 24 hours while open, and shutdown. Upgrades take a pre-migration snapshot. Automatic/manual/pre-migration snapshots retain the latest 30 generations; safety snapshots are deliberately retained until a technician removes them after review. Safety snapshots can grow and must be reviewed periodically.

Data & Backup -> Backup Data opens a native Save dialog. Keep an off-device copy. A .db backup contains business records, NOT uploaded images, admin credentials or optional service settings. Copy uploads separately. For complete disaster recovery, while the app is CLOSED copy the whole user-data directory to protected external storage. Do not share security.json publicly.

Restore Database stages a consistent snapshot, checks SQLite integrity, all relationships, the full schema and migration checksums, asks for confirmation, drains API requests, disconnects Prisma, creates a safety backup and replaces the database. The app restarts with existing local administrator credentials. An interruption marker recovers a missing active file. A backup from a newer unknown version is rejected. On startup failure, keep all files and contact support; never delete pos.db to make startup succeed. A technician can close the app and restore a validated safety snapshot, retaining the original directory first.

## Optional integrations and printing
Core operations have no cloud requirement. Product uploads are local PNG/JPEG/WebP files. Fonts and icons are bundled. Configure optional Groq/Meta credentials in settings/integrations.json using GROQ_API_KEY, META_WHATSAPP_TOKEN, META_PHONE_NUMBER_ID and OWNER_WHATSAPP_NUMBER; restart afterward. Failures use bounded timeouts and do not roll back a saved sale. Desktop invoice messages use a shop-collection notice instead of a public link; confirm the approved WhatsApp template accepts this text. Incoming Meta webhooks cannot reach a loopback-only machine; use the cloud deployment if inbound delivery callbacks are required.

Receipts use Chromium/Windows printing. Labels use an escaped same-origin print frame. USB barcode scanners acting as keyboards remain supported; camera access is restricted to the app window. Verify the client's actual printer, paper size and scanner before release. A local invoice QR contains a record identifier, not a customer-accessible internet URL.

## Web development
~~~powershell
npm run web
npm run build:web
cd mobile-shop-pos/backend
npm ci
npx prisma generate
npm start
~~~

Configure the existing web .env variables using .env.example. Root desktop generation never overwrites the web Prisma client. Never package .env files or production credentials. For the web password hash helper, feed a unique password through stdin; do not put it into source, shell arguments or documentation.

## Release and updates
Provide the approved logo at mobile-shop-pos/assets/icon.ico and configure build.win.icon as documented in assets/README.md. Developer builds currently use Electron's default icon. Set the real legal publisher metadata when known. Never claim an unsigned installer is signed. Windows SmartScreen may warn about unsigned/unrecognized software; do not disable Windows security. Configure electron-builder certificate signing through protected CI secrets when a certificate is available.

1. Complete RELEASE_CHECKLIST.md and review QA_REPORT.md.
2. Update root package.json version and run npm install --package-lock-only --ignore-scripts.
3. Run npm ci, desktop:prepare, npm test, native smoke test and desktop:build.
4. Compute Get-FileHash release/SR-Mobile-POS-Setup-VERSION.exe -Algorithm SHA256.
5. Commit, tag vVERSION and push the tag without force pushing.
6. Open GitHub Releases -> Draft a new release -> choose vVERSION. Upload installer, checksum and release notes. Publish only after clean-machine and upgrade checks pass.

The optional GitHub workflow uploads a build artifact and has contents:read permission; it does not publish releases. Download and test its installer before manual release. Updates are full installers; there is no unverified auto-updater. Close the app, retain a current external backup, install the newer version under the same Windows user, then verify products/customers/sales before reopening the shop.

References: [Electron security](https://www.electronjs.org/docs/latest/tutorial/security), [NSIS configuration](https://www.electron.build/nsis.html), [Prisma SQLite](https://www.prisma.io/docs/orm/overview/databases/sqlite).
