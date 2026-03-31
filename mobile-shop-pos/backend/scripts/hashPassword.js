// scripts/hashPassword.js
// Run: node scripts/hashPassword.js
const bcrypt = require('bcryptjs');

const password = process.argv[2] || 'Admin@SR2024';
const hash = bcrypt.hashSync(password, 10);

console.log('\n✅ Password hashed successfully!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Password: ${password}`);
console.log(`Hash: ${hash}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\nPaste the hash above as ADMIN_PASSWORD in your .env file.\n');
