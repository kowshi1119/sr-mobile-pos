# Changelog

## 1.1.0 — 2026-09-24

### Added
- **Owner and staff accounts.** First launch creates the owner (username + password). The owner adds staff logins under **Users & Permissions** and ticks exactly what each person may do: sales, discounts, changing prices at checkout, adding/editing products, changing product prices, changing stock, deleting products, seeing cost and profit, categories, bundles, customers, debts, loyalty, repairs, suppliers, expenses, targets, messages, AI and backups. Cashier and Manager presets.
- Permission changes, disabling a user and password resets apply immediately.
- Every user can change their own password. Receipts show who made the sale.
- Upgrading from 1.0.0 turns the existing administrator login into the owner account.

### Fixed
- Products could not be added on a new installation: the Add Product button was silently disabled until a category existed. The form now explains this and can create a category inline.
- A blank cost price, blank category name or other invalid input caused a generic error. These now save with sensible defaults or show a clear message.
- Every business error (insufficient stock, IMEI already sold, discount too large, duplicate barcode) was hidden behind one generic message. Readable messages are shown, and the log records what failed.
- Sign-in and the light/dark choice were lost on every restart. The local port is now saved.
- Light mode: text, labels, input borders and table lines were invisible or too faint on the cream background. The whole app now adapts to the theme, with readable brand and status colours.
- Failed saves on some pages showed nothing; failed image uploads showed nothing. Both now show a message.
- A pointless "IMEI summary" pop-up appeared after saving every non-IMEI product.
- The Scan Product button was partly hidden behind the AI assistant button.
- Product SKUs used a 3-character random part and could collide.
- Missing image files returned the app page instead of "not found".
- A pre-migration backup was created on every launch; it is now created only before an actual upgrade.

## 1.0.0 — 2026-09-22
- First Windows desktop release: Electron, local Express API, SQLite, automatic backups, restore, NSIS installer.
