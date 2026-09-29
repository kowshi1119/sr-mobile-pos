// Which permission opens each page. `null` means any signed-in user; 'owner' means the owner only.
// The server enforces the same rules; this only decides what the menu and routes show.
export const PAGES = [
  { to: '/dashboard',     icon: 'dashboard',      label: 'Dashboard',     perm: ['dashboard.view'] },
  { to: '/analytics',     icon: 'bar_chart',      label: 'Analytics',     perm: ['analytics.view'] },
  { to: '/billing',       icon: 'point_of_sale',  label: 'New Sale',      perm: ['sales.create'] },
  { to: '/products',      icon: 'inventory_2',    label: 'Products',      perm: ['products.view'] },
  { to: '/bundles',       icon: 'inventory',      label: 'Bundles',       perm: ['bundles.manage'] },
  { to: '/suppliers',     icon: 'local_shipping', label: 'Suppliers',     perm: ['suppliers.manage'] },
  { to: '/expenses',      icon: 'receipt',        label: 'Expenses',      perm: ['expenses.manage'] },
  { to: '/categories',    icon: 'category',       label: 'Categories',    perm: ['categories.manage'] },
  { to: '/customers',     icon: 'people',         label: 'Customers',     perm: ['customers.view'] },
  { to: '/repairs',       icon: 'build',          label: 'Repairs',       perm: ['repairs.view', 'repairs.manage'] },
  { to: '/notifications', icon: 'notifications',  label: 'Messages',      perm: ['notifications.view'] },
  { to: '/data',          icon: 'database',       label: 'Data & Backup', perm: ['data.backup'] },
  { to: '/users',         icon: 'manage_accounts', label: 'Users & Permissions', perm: 'owner' },
]
