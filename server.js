const express = require('express');
const crypto = require('crypto');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

// Database Connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/gshare_db',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

const GSHARE_SIGNING_SECRET = process.env.GSHARE_SIGNING_SECRET || "ca89e84aec6687bd24a2ab11c319acec5033045b8688177e";

// 1. Webhook Listener Endpoint (Inbound from GShare)
app.post('/api/processors/gshare/webhook', async (req, res) => {
    try {
        const signature = req.headers['x-gshare-signature'];
        const payload = JSON.stringify(req.body);

        if (signature) {
            const expectedSignature = crypto
                .createHmac('sha256', GSHARE_SIGNING_SECRET)
                .update(payload)
                .digest('hex');

            if (signature !== expectedSignature) {
                return res.status(401).json({ error: 'Unauthorized signature' });
            }
        }

        const { order_ref, status } = req.body;
        console.log(`[Webhook Received] Order: ${order_ref} | Status: ${status}`);

        await pool.query(
            `UPDATE orders SET status = $1, updated_at = NOW() WHERE order_ref = $2`,
            [status ? status.toUpperCase() : 'FULFILLED', order_ref]
        );

        return res.status(200).json({ status: 'success' });
    } catch (err) {
        console.error('[Webhook Error]', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// 2. Simple Test Orders Endpoint for the Dashboard
app.get('/api/orders', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 50');
        res.json(rows);
    } catch (err) {
        // Fallback demo data if DB isn't fully attached yet
        res.json([
            { order_ref: 'ORD-1001', recipient_phone: '0241234567', network: 'MTN', bundle_size: '1GB', amount_charged: 5.00, processor: 'GShare', status: 'FULFILLED' },
            { order_ref: 'ORD-1002', recipient_phone: '0559876543', network: 'MTN', bundle_size: '2GB', amount_charged: 10.00, processor: 'GShare', status: 'PENDING' }
        ]);
    }
});

// Serve Admin Dashboard UI directly
app.get('/admin', (req, res) => {
    res.sendFile(__dirname + '/admin.html');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`GShare Bridge Server active on port ${PORT}`);
});

