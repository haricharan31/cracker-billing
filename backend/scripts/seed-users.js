require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../src/config/database');

async function seedUsers() {
  const adminHash = await bcrypt.hash('admin123', 10);
  const operatorHash = await bcrypt.hash('operator123', 10);

  await pool.query(`
    INSERT INTO users (name, username, password_hash, role) VALUES
      ('Administrator', 'admin', $1, 'admin'),
      ('Operator', 'operator', $2, 'operator')
    ON CONFLICT (username) DO NOTHING
  `, [adminHash, operatorHash]);

  console.log('Users seeded successfully');
  process.exit(0);
}

seedUsers().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
