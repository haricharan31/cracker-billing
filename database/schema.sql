CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'operator')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  shop_name VARCHAR(150) NOT NULL,
  customer_name VARCHAR(150) NOT NULL,
  phone VARCHAR(15),
  location TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  category VARCHAR(20) NOT NULL CHECK (category IN ('standard', 'vadivel', 'others')),
  item_name VARCHAR(150) NOT NULL,
  item_code VARCHAR(20) UNIQUE NOT NULL,
  boxes_per_case INTEGER NOT NULL DEFAULT 12,
  price_per_box DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bills (
  id SERIAL PRIMARY KEY,
  bill_number VARCHAR(30) UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES customers(id),
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  standard_subtotal DECIMAL(10,2) DEFAULT 0,
  vadivel_subtotal DECIMAL(10,2) DEFAULT 0,
  others_subtotal DECIMAL(10,2) DEFAULT 0,
  total_cases INTEGER DEFAULT 0,
  hamali_amount DECIMAL(10,2) DEFAULT 0,
  amount_paid_before DECIMAL(10,2) DEFAULT 0,
  grand_total DECIMAL(10,2) DEFAULT 0,
  balance_due DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_comment TEXT,
  approval_token VARCHAR(255) UNIQUE,
  token_expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bill_items (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER REFERENCES bills(id),
  category VARCHAR(20) NOT NULL CHECK (category IN ('standard', 'vadivel', 'others')),
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  item_name VARCHAR(150) NOT NULL,
  company_name VARCHAR(100),
  serial_number INTEGER NOT NULL,
  cases INTEGER DEFAULT 0,
  boxes INTEGER NOT NULL,
  rate_per_box DECIMAL(10,2) NOT NULL,
  discount_percent DECIMAL(5,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE bills ADD COLUMN IF NOT EXISTS amount_paid_date DATE;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS sparklers_subtotal DECIMAL(10,2) DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS guns_subtotal DECIMAL(10,2) DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS rp_count INTEGER;

CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO settings (key, value) VALUES
  ('hamali_rate', '11'),
  ('bill_prefix', 'LNT'),
  ('business_name', 'Laxmi Narasimha Traders'),
  ('owner_phone', '')
ON CONFLICT (key) DO NOTHING;
