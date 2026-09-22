# Install SR Mobile POS

Use the installer supplied by your shop's software provider. Do not use a developer test build for live business data.

1. Download or copy SR-Mobile-POS-Setup-1.0.0.exe to your Windows computer.
2. Close any running copy of SR Mobile POS.
3. Double-click the installer and follow the installation screens.
4. Open SR Mobile POS from the desktop or Start Menu.
5. On first launch, enter your administrator email and choose a private password with at least 12 characters. Store it safely. There is no default password.
6. Add your categories/products and begin using the POS.

Your computer does not need Node.js, PostgreSQL, Git or other developer tools. Products, customers, sales and other local business records stay on this computer. You may need to sign in again each time the app opens. AI and WhatsApp require internet and service configuration; their failure does not undo a saved sale. Local invoice QR codes are record references, not internet links.

## Protect your shop data

The app saves automatic backups, but a backup on the same computer will not protect against a failed or stolen computer. Open Data & Backup -> Backup Data and save a copy to another drive regularly. Keep that drive safe. Ask your provider to include product images and settings in a full backup; the .db file contains business records only.

To restore, choose Data & Backup -> Restore Database, select your backup and review the confirmation. Restoring replaces current business records. The app saves a safety copy first and then restarts. Your local login remains unchanged.

For an update, make an external backup, close SR Mobile POS, then install the new version provided by your supplier. Your shop records remain separate from the program. Uninstalling normally keeps the data for later reinstallation.

If Windows warns about an unsigned or unrecognized installer, ask your provider to confirm the source and checksum. Do not turn off Windows security. If the app cannot open, keep your data files and ask for support; do not delete the database.
