// Single source of truth for staff permissions. The owner always has every permission;
// user management, restore, import and reset are owner-only and are never grantable.
const GROUPS = [
  { name: 'Dashboard & Reports', items: [
    ['dashboard.view', 'View dashboard'],
    ['analytics.view', 'View analytics & profit reports'],
  ] },
  { name: 'Sales', items: [
    ['sales.create', 'Make sales (billing)'],
    ['sales.view', 'View sales history & invoices'],
    ['sales.discount', 'Give discounts'],
    ['sales.changePrice', 'Change item price at checkout'],
  ] },
  { name: 'Products & Stock', items: [
    ['products.view', 'View products'],
    ['products.create', 'Add products'],
    ['products.edit', 'Edit product details'],
    ['products.editPrice', 'Change product prices'],
    ['products.editStock', 'Change stock quantity & IMEI'],
    ['products.delete', 'Delete (deactivate) products'],
    ['products.viewCost', 'See cost price & profit'],
    ['categories.manage', 'Manage categories'],
    ['bundles.manage', 'Manage bundles'],
  ] },
  { name: 'Customers', items: [
    ['customers.view', 'View customers'],
    ['customers.manage', 'Add / edit customers'],
    ['debt.manage', 'Record debts & payments'],
    ['loyalty.manage', 'Manage loyalty points'],
  ] },
  { name: 'Repairs', items: [
    ['repairs.view', 'View repairs'],
    ['repairs.manage', 'Create / update repairs'],
  ] },
  { name: 'Business', items: [
    ['suppliers.manage', 'Suppliers & purchases'],
    ['expenses.manage', 'Expenses'],
    ['targets.manage', 'Sales targets'],
    ['notifications.view', 'Messages & WhatsApp'],
    ['ai.use', 'AI assistant'],
  ] },
  { name: 'Data', items: [
    ['data.backup', 'Backup & export data'],
  ] },
];
const KEYS = GROUPS.flatMap(g => g.items.map(([key]) => key));
const PRESETS = {
  Cashier: ['sales.create', 'sales.view', 'products.view', 'customers.view', 'customers.manage', 'repairs.view', 'repairs.manage', 'loyalty.manage'],
  Manager: KEYS.filter(k => k !== 'data.backup'),
};
function sanitize(list) {
  if (!Array.isArray(list)) return [];
  return [...new Set(list.filter(k => typeof k === 'string' && KEYS.includes(k)))];
}
function parse(stored) {
  try { return sanitize(JSON.parse(stored || '[]')); } catch { return []; }
}
function has(user, ...keys) {
  if (!user) return false;
  if (user.role === 'OWNER') return true;
  return keys.some(k => user.permissions?.includes(k));
}
// Removes cost prices from nested response data for users without products.viewCost.
function stripCost(user, data) {
  if (has(user, 'products.viewCost')) return data;
  const walk = v => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && Object.getPrototypeOf(v) === Object.prototype) {
      const out = {};
      for (const [k, item] of Object.entries(v)) if (k !== 'costPrice' && k !== 'unitCost') out[k] = walk(item);
      return out;
    }
    return v;
  };
  return walk(data);
}
module.exports = { GROUPS, KEYS, PRESETS, sanitize, parse, has, stripCost };
