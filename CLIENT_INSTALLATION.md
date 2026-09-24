# Install SR Mobile POS

Use the installer supplied by your shop's software provider. Do not use a developer test build for live business data.

## New installation

1. Download or copy SR-Mobile-POS-Setup-1.1.0.exe to your Windows computer.
2. Close any running copy of SR Mobile POS.
3. Double-click the installer and follow the installation screens.
4. Open SR Mobile POS from the desktop or Start Menu.
5. On first launch, create the **owner account**: your name, a username (for example `owner`) and a private password with at least 12 characters. Store it safely. There is no default password.
6. Open **Products → Add Product**. If you have no categories yet, type a category name (for example "Mobile Phones") in the product form and press **Add category**, then fill in the product name and selling price. Cost price is optional.

Your computer does not need Node.js, PostgreSQL, Git or other developer tools. Products, customers, sales and other business records stay on this computer. The app remembers your sign-in and light/dark choice between restarts. AI and WhatsApp need internet and service configuration; if they fail, the sale is still saved. Local invoice QR codes are record references, not internet links.

## Updating from version 1.0.0

1. In the old version, open **Data & Backup → Backup Data** and save a copy to a USB drive.
2. Close SR Mobile POS.
3. Run SR-Mobile-POS-Setup-1.1.0.exe. It installs over the old version; your shop data is kept.
4. Open the app and sign in with the **same email and password you used in 1.0.0**. That login becomes the owner account. You can keep using the email as your username.

## Staff logins and permissions

Only the owner can manage logins.

1. Open **Users & Permissions → Add Staff**.
2. Enter the staff member's name, a username (for example `cashier1`) and a password with at least 8 characters.
3. Tick what they are allowed to do. **Cashier** is a quick start for sales staff: make sales, view products and customers, handle repairs and loyalty points. **Manager** allows almost everything except backups.
4. Press **Create login** and give the username and password to the staff member.

Examples of what you can allow or block: adding products, editing product details, **changing product prices**, changing stock, deleting products, seeing cost price and profit, giving discounts, changing a price at checkout, customers and debts, repairs, suppliers, expenses, reports and backups.

Changes apply immediately, even if the staff member is already signed in. Use **Disable** to stop someone signing in, **Reset password** if they forget it, and **Delete** when they leave. Restoring backups, importing data, resetting data and managing users always stay with the owner. Each receipt shows the name of the person who made the sale.

Everyone can change their own password with **Change Password** in the menu.

## Protect your shop data

The app saves automatic backups, but a backup on the same computer will not protect against a failed or stolen computer. Open Data & Backup -> Backup Data and save a copy to another drive regularly. Keep that drive safe. Ask your provider to include product images and settings in a full backup; the .db file contains business records only.

To restore, the owner chooses Data & Backup -> Restore Database, selects a backup and confirms. Restoring replaces current business records and the staff logins with the ones in the backup. The app saves a safety copy first and then restarts. The owner login keeps working after a restore.

For an update, make an external backup, close SR Mobile POS, then install the new version provided by your supplier. Your shop records remain separate from the program. Uninstalling normally keeps the data for later reinstallation.

If Windows warns about an unsigned or unrecognized installer, ask your provider to confirm the source and checksum. Do not turn off Windows security. If the app cannot open, keep your data files and ask for support; do not delete the database.
