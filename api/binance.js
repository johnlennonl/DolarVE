// ==========================================
// API Route Serverless - Proxy Binance P2P
// Se ejecuta en el servidor de Vercel (sin CORS)
// ==========================================

export default async function handler(req, res) {
    // Permitir CORS desde cualquier origen
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Intento 1: CriptoYa (más rápido, ya trae ask/bid)
        try {
            const criptoYaRes = await fetch('https://criptoya.com/api/binancep2p/usdt/ves/1', {
                headers: { 'User-Agent': 'DolarVE-App/2.0' },
                signal: AbortSignal.timeout(4000)
            });

            if (criptoYaRes.ok) {
                const data = await criptoYaRes.json();
                if (data && data.ask > 0 && data.bid > 0) {
                    const promedio = (parseFloat(data.ask) + parseFloat(data.bid)) / 2;
                    return res.status(200).json({
                        success: true,
                        source: 'criptoya',
                        price: promedio,
                        ask: data.ask,
                        bid: data.bid,
                        timestamp: Date.now()
                    });
                }
            }
        } catch (e) {
            console.log('[Proxy] CriptoYa falló, intentando Binance directo...');
        }

        // Intento 2: Binance P2P Directo (sin CORS porque es server-side)
        const binanceRes = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify({
                asset: 'USDT',
                fiat: 'VES',
                tradeType: 'BUY',
                page: 1,
                rows: 15,
                payTypes: [],
                publisherType: 'merchant',
                merchantCheck: true
            }),
            signal: AbortSignal.timeout(6000)
        });

        if (!binanceRes.ok) throw new Error(`Binance HTTP ${binanceRes.status}`);
        const binanceData = await binanceRes.json();

        if (binanceData.data && binanceData.data.length > 0) {
            const prices = binanceData.data
                .map(ad => parseFloat(ad.adv?.price || 0))
                .filter(p => p > 0)
                .sort((a, b) => a - b);

            if (prices.length > 0) {
                const mid = Math.floor(prices.length / 2);
                const mediana = prices.length % 2 !== 0
                    ? prices[mid]
                    : (prices[mid - 1] + prices[mid]) / 2;

                return res.status(200).json({
                    success: true,
                    source: 'binance-direct',
                    price: mediana,
                    count: prices.length,
                    timestamp: Date.now()
                });
            }
        }

        throw new Error('No valid data from any source');

    } catch (error) {
        console.error('[Proxy] Error total:', error.message);
        return res.status(500).json({
            success: false,
            error: error.message,
            timestamp: Date.now()
        });
    }
}
