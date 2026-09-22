# Desktop migration audit and plan

Baseline: React 18/Vite 5 entry frontend/src/main.jsx; BrowserRouter; Express backend/server.js; Prisma 5.22 PostgreSQL; 23 business models. Route modules: auth, categories, products, sales, invoice, customers, repairs, dashboard, notifications, ai, debt, loyalty, suppliers, expenses, targets, bundles, reminders, whatsapp-summary, data.

Preserve the cloud PostgreSQL schema. Generate a separate SQLite client with all relationships, indexes and unique constraints retained. Convert PostgreSQL enums to checked text in the SQLite migration. Remove native Decimal annotations; promote existing monetary Floats to Decimal locally, leaving purchase quantity fractional. Use Decimal arithmetic for sale totals. Keep monetary inputs within two decimal places and the original DECIMAL(10,2) range. SQLite NUMERIC affinity is not a fixed-scale decimal storage engine: round financial writes and calculations explicitly; retain this limitation in release QA.

Use Electron’s bundled Node runtime, one shared Prisma client, and a loopback-only Express listener on an OS-selected port. Serve the built React application from that same origin, keeping BrowserRouter and relative /api requests. Restrict the server to requests bearing a per-launch capability injected by Electron’s session, with origin/host checks and normal JWT authentication.

Initialize a writable userData tree, apply checksummed SQL migrations transactionally and back up before upgrades. First-run administrator setup has no preset password. JWT secret and bcrypt hash remain in local settings. Consistent SQLite snapshots use VACUUM INTO. Restore stages and validates a snapshot, creates a safety backup, drains requests and closes Prisma before replacing the database.

External integrations: Cloudinary image uploads become local in desktop mode; Groq and Meta WhatsApp remain optional, with bounded timeouts. Bundle Google Fonts/Material Symbols locally. Existing browser receipt printing is retained; label popup content must be escaped. The OfflineSale table is retained but there is no working offline cloud-sync queue. Desktop does not depend on one. Local invoice QR codes cannot be opened on customer phones.

Known issues found: separate invoice-counter connection inside sale transaction; debt writes and loyalty accrual after sale commit; float financial calculations; permissive CORS; publicly readable sequential invoices; raw errors; tracked backend/hash.txt and documented default credentials. Review and remediate without printing values.

Phases: (1) database/runtime foundation, (2) local security/setup and business adapters, (3) snapshots/restore and offline UI, (4) NSIS packaging, (5) integration/security/build QA and operator documentation.
