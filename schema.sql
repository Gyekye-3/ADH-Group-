-- Database Schema for GShare & Logistics Engine

CREATE TABLE IF NOT EXISTS Processors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    base_url VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Pricing_Tiers (
    id SERIAL PRIMARY KEY,
    network VARCHAR(20) NOT NULL,
    bundle_size VARCHAR(20) NOT NULL,
    cost_price DECIMAL(10,2) NOT NULL,
    selling_price DECIMAL(10,2) NOT NULL,
    processor_id INT REFERENCES Processors(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS Orders (
    id SERIAL PRIMARY KEY,
    order_ref VARCHAR(100) UNIQUE NOT NULL,
    recipient_phone VARCHAR(20) NOT NULL,
    network VARCHAR(20) NOT NULL,
    bundle_size VARCHAR(20) NOT NULL,
    amount_charged DECIMAL(10,2) NOT NULL,
    processor VARCHAR(50) DEFAULT 'GShare',
    status VARCHAR(30) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed Initial Processors
INSERT INTO Processors (name, base_url) 
VALUES ('GShare', 'https://up.mygroupshare.app/api')
ON CONFLICT (name) DO NOTHING;

