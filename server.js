const express = require('express');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/gshare_db',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const GSHARE_SIGNING_SECRET = process.env.GSHARE_SIGNING_SECRET || "ca89e84aec6687bd24a2ab11c319acec5033045b8688177e";

// House Cost Lookup Table (Matching ADH Group Rates)
const HOUSE_COSTS = {
    '1GB': 3.75,
    '2GB': 7.50,
    '3GB': 11.25,
    '4GB': 15.00
};

// 1. Mobile Key Generation (Fail-Proof: Returns Keys Instantly)
app.all('/api/admin/generate-client-key', async (req, res) => {
    try {
        const apiKey = 'gsk_' + crypto.randomBytes(16).toString('hex');
        const signingSecret = crypto.randomBytes(32).toString('hex');

        // Optional DB log attempt (does not stop key output if DB is offline)
        try {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS gshare_clients (
                    id SERIAL PRIMARY KEY,
                    client_name VARCHAR(100) NOT NULL,
                    api_key VARCHAR(100) UNIQUE NOT NULL,
                    signing_secret VARCHAR(100) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            `);
            await pool.query(
                `INSERT INTO gshare_clients (client_name, api_key, signing_secret) VALUES ($1, $2, $3)`,
                ['ADH Group Mobile Admin', apiKey, signingSecret]
            );
        } catch (dbErr) {
            console.log('[DB Optional Notice]', dbErr.message);
        }

        return res.status(200).json({
            status: 'success',
            client_name: 'ADH Group Mobile Admin',
            api_key: apiKey,
            signing_secret: signingSecret
        });
    } catch (err) {
        return res.status(500).json({ error: 'Failed to generate key', details: err.message });
    }
});

// 2. GShare Inbound Webhook Listener
app.post('/api/processors/gshare/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-gshare-signature'];
        const payload = JSON.stringify(req.body);

        if (signature && GSHARE_SIGNING_SECRET) {
            const expectedSignature = crypto
                .createHmac('sha256', GSHARE_SIGNING_SECRET)
                .update(payload)
                .digest('hex');

            if (signature !== expectedSignature) {
                return res.status(401).json({ error: 'Unauthorized signature' });
            }
        }

        const { order_ref, status } = req.body;
        try {
            await pool.query(
                `UPDATE orders SET status = $1, updated_at = NOW() WHERE order_ref = $2`,
                [status ? status.toUpperCase() : 'FULFILLED', order_ref]
            );
        } catch (dbErr) {
            console.log('[DB Update Notice]', dbErr.message);
        }

        return res.status(200).json({ status: 'success' });
    } catch (err) {
        console.error('[Webhook Error]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// 3. Fetch Orders Live from Database
app.get('/api/orders', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 50');
        res.json(rows);
    } catch (err) {
        res.json([]);
    }
});

// Serve Dashboard UI
app.get(['/', '/admin'], (req, res) => {
    res.sendFile(__dirname + '/admin.html');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`ADH Group Platform Server running on port ${PORT}`));
