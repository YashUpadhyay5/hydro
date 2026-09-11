const axios = require('axios');

class RenderKeepAliveService {
    static async syncWithDatabase(statusDetails = {}) {
        try {
            const Rule = require('../models/Rule');
            const now = new Date().toISOString();
            await Rule.upsert({
                key: 'render_last_keep_alive_ping',
                value: now,
                label: 'Render Last Keep-Alive Ping',
                description: 'Timestamp of the latest autonomous anti-sleep heartbeat ping',
                category: 'system_heartbeat'
            }).catch(() => {});

            await Rule.upsert({
                key: 'render_anti_sleep_status',
                value: statusDetails.status || 'ACTIVE',
                label: 'Render Anti-Sleep Status',
                description: 'Current operational status of the Render anti-sleep heartbeat service',
                category: 'system_heartbeat'
            }).catch(() => {});

            console.log(`[Render Keep-Alive DB Sync] Synchronized heartbeat timestamp (${now}) to database.`);
        } catch (dbErr) {
            console.warn(`[Render Keep-Alive DB Sync Notice] Database synchronization notice: ${dbErr.message}`);
        }
    }

    static start() {
        const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes (Render sleeps after 15 min of no HTTP traffic)
        
        const defaultUrls = [
            process.env.RENDER_EXTERNAL_URL ? `${process.env.RENDER_EXTERNAL_URL}/api/keep-alive` : null,
            'https://hydro-backend-api.onrender.com/api/keep-alive',
            'https://hydro-hrms-app.onrender.com/api'
        ].filter(Boolean);

        // Remove duplicates
        const targetUrls = [...new Set(defaultUrls)];

        const pingTargets = async () => {
            try {
                console.log(`[Render Keep-Alive Pinger] Executing scheduled anti-sleep heartbeat ping...`);
                let successfulPings = 0;

                for (const url of targetUrls) {
                    try {
                        const res = await axios.get(url, { 
                            timeout: 15000,
                            headers: { 'User-Agent': 'Hydro-Render-KeepAlive/1.0' }
                        });
                        console.log(`[Render Keep-Alive Pinger] ✓ Pinged ${url} - Status: ${res.status}`);
                        successfulPings++;
                    } catch (err) {
                        console.warn(`[Render Keep-Alive Pinger Notice] Ping to ${url} notice: ${err.message}`);
                    }
                }

                // Synchronize status record to system_rules database table safely
                await this.syncWithDatabase({
                    status: successfulPings > 0 ? 'ACTIVE_ONLINE' : 'PING_WARNING',
                    successfulPings
                }).catch(err => console.warn('[KeepAlive DB Sync Notice]:', err.message));
            } catch (globalErr) {
                console.warn('[Render Keep-Alive Global Notice]:', globalErr.message);
            }
        };

        // Initial ping 15 seconds after server startup
        setTimeout(() => {
            pingTargets().catch(() => {});
        }, 15000);

        // Recurring ping every 10 minutes
        setInterval(() => {
            pingTargets().catch(() => {});
        }, INTERVAL_MS);

        console.log('[Render Keep-Alive Service] Autonomous 10-minute anti-sleep pinger initialized with crash-proof guards.');
    }
}

module.exports = RenderKeepAliveService;
