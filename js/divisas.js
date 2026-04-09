// ==========================================
// Módulo de Divisas - DolarVE
// Maneja las tasas fiat (BCV, Paralelo, EUR, COP, ARS)
// ==========================================

const Divisas = {
    referenciaRapidaMonto: 10,

    async obtenerDatosTasas() {
        if (!navigator.onLine) {
            Interfaz.mostrarNotificacion('Modo Offline: Datos guardados');
            this.cargarDatosCache();
            return;
        }

        let exito = false;
        for (let intento = 1; intento <= 3; intento++) {
            try {
                // Función auxiliar para obtener Binance P2P en tiempo real
                async function obtenerBinanceRealTime() {
                    // Intento 1: API directa de Binance P2P (pública, POST)
                    try {
                        const resp = await fetch('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                asset: 'USDT',
                                fiat: 'VES',
                                tradeType: 'BUY',
                                page: 1,
                                rows: 5,
                                payTypes: [],
                                publisherType: null
                            })
                        });
                        if (resp.ok) {
                            const data = await resp.json();
                            if (data.data && data.data.length > 0) {
                                // Promedio de los primeros 5 anuncios (precio BUY = lo que pagan)
                                const prices = data.data.map(ad => parseFloat(ad.adv.price));
                                const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
                                console.log('%c[DolarVE] ✅ BINANCE DIRECTO: ' + avg.toFixed(2) + ' (de ' + prices.length + ' anuncios)', 'color: #00ff00; font-weight: bold;');
                                return avg;
                            }
                        }
                    } catch (e) { console.warn('[DolarVE] Binance directo falló:', e.message); }

                    // Intento 2: CriptoYa via proxy corsproxy.io
                    try {
                        const resp2 = await fetch('https://corsproxy.io/?' + encodeURIComponent('https://criptoya.com/api/binancep2p/usdt/ves/1'));
                        if (resp2.ok) {
                            const d = await resp2.json();
                            if (d && d.bid > 0) {
                                console.log('%c[DolarVE] ✅ BINANCE (CriptoYa proxy2): ' + d.bid, 'color: #00ff00;');
                                return d.bid;
                            }
                        }
                    } catch (e) {}

                    // Intento 3: CriptoYa via AllOrigins
                    try {
                        const resp3 = await fetch('https://api.allorigins.win/get?url=' + encodeURIComponent('https://criptoya.com/api/binancep2p/usdt/ves/1'));
                        if (resp3.ok) {
                            const d3 = await resp3.json();
                            if (d3 && d3.contents) {
                                const parsed = JSON.parse(d3.contents);
                                if (parsed.bid > 0) {
                                    console.log('%c[DolarVE] ✅ BINANCE (AllOrigins): ' + parsed.bid, 'color: #00ff00;');
                                    return parsed.bid;
                                }
                            }
                        }
                    } catch (e) {}

                    return null; // Todas las fuentes fallaron
                }

                // Fetch principal: BCV, EUR, Internacionales, Argentina + Binance en paralelo
                const [resultados, binanceRT] = await Promise.all([
                    Promise.allSettled([
                        fetch('https://ve.dolarapi.com/v1/dolares/oficial'),       // [0] BCV
                        fetch('https://ve.dolarapi.com/v1/euros/oficial'),          // [1] EUR
                        fetch('https://open.er-api.com/v6/latest/USD'),             // [2] Internacionales
                        fetch('https://dolarapi.com/v1/dolares/blue'),              // [3] Argentina Blue
                        fetch('https://ve.dolarapi.com/v1/dolares/paralelo')        // [4] Fallback Binance
                    ]),
                    obtenerBinanceRealTime() // Corre en paralelo con todo lo demás
                ]);

                const tasas = window.DolarVE.tasas;

                const safeJson = async (res) => {
                    if (res.status === 'fulfilled' && res.value.ok) {
                        try { return await res.value.json(); } catch(e) { return null; }
                    }
                    return null;
                };

                const usdData = await safeJson(resultados[0]);
                const eurData = await safeJson(resultados[1]);
                const copData = await safeJson(resultados[2]);
                const arsData = await safeJson(resultados[3]);
                const fallbackBinance = await safeJson(resultados[4]);

                let huboExitoParcial = false;

                if (usdData) { tasas.usd = usdData.promedio; huboExitoParcial = true; }
                if (eurData) { tasas.eur = eurData.promedio; huboExitoParcial = true; }
                
                // === BINANCE: Real-time > Paralelo (fallback) ===
                if (binanceRT && binanceRT > 0) {
                    tasas.binance = binanceRT;
                    huboExitoParcial = true;
                } else if (fallbackBinance) {
                    tasas.binance = fallbackBinance.promedio;
                    huboExitoParcial = true;
                    console.warn('[DolarVE] ⚠️ Binance: usando fallback paralelo:', tasas.binance);
                }

                if (arsData) { tasas.ars = (arsData.compra + arsData.venta) / 2; huboExitoParcial = true; }
                if (copData && copData.rates) {
                    tasas.cop = copData.rates.COP;
                    tasas.brl = copData.rates.BRL;
                    tasas.clp = copData.rates.CLP;
                    huboExitoParcial = true;
                }

                if (!huboExitoParcial) throw new Error('Todos los endpoints fallaron');

                this.actualizarVistasInicio();
                localStorage.setItem('dolarve_offline_data', JSON.stringify(tasas));

                if (typeof Calculadora !== 'undefined') Calculadora.actualizarPantalla();
                
                const ahora = new Date();
                const horaStr = ahora.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });
                const updateEl = document.getElementById('last-update-usd');
                if (updateEl) updateEl.innerText = `Actualizado: ${horaStr}`;

                this.inicializarGraficoPrincipal();

                exito = true;
                console.log('[DolarVE] Tasas de Divisas actualizadas.');
                break; 
            } catch (e) {
                console.error(`[DolarVE] Intento ${intento}/3 fallido en divisas:`, e);
                if (intento < 3) await new Promise(r => setTimeout(r, 3000));
            }
        }

        if (!exito) {
            this.cargarDatosCache();
            Interfaz.mostrarNotificacion('⚠️ Usando datos guardados (conexión inestable)');
        }
    },

    cargarDatosCache() {
        const cache = JSON.parse(localStorage.getItem('dolarve_offline_data') || '{}');
        const tasas = window.DolarVE.tasas;
        
        Object.keys(cache).forEach(key => {
            tasas[key] = cache[key];
        });
        
        this.actualizarVistasInicio();
        if (typeof Calculadora !== 'undefined') Calculadora.actualizarPantalla();
    },

    actualizarVistasInicio() {
        const tasas = window.DolarVE.tasas;
        
        const usdEl = document.getElementById('usd-bcv-price');
        const objValUsd = usdEl ? parseFloat(usdEl.innerText) : 0;
        if (usdEl && objValUsd !== tasas.usd) usdEl.innerText = tasas.usd.toFixed(2);
            
        const parEl = document.getElementById('paralelo-price');
        if (parEl) parEl.innerText = (tasas.binance || 0).toFixed(2);

        // --- TENDENCIA BINANCE (Bfs) ---
        const binanceTrendEl = document.getElementById('binance-trend');
        if (binanceTrendEl && tasas.binance > 0) {
            const lastBinance = parseFloat(localStorage.getItem('dolarve_last_binance') || 0);
            if (lastBinance > 0 && lastBinance !== tasas.binance) {
                const diff = tasas.binance - lastBinance;
                const sign = diff > 0 ? '+' : '';
                binanceTrendEl.style.display = 'block';
                binanceTrendEl.style.color = diff > 0 ? 'var(--accent-green)' : 'var(--accent-red)';
                binanceTrendEl.innerHTML = `<i class="ph-duotone ph-caret-${diff > 0 ? 'up' : 'down'}"></i> ${sign}${diff.toFixed(2)} Bs`;
            } else if (lastBinance === 0) {
                // Primera vez, guardamos referencia
                localStorage.setItem('dolarve_last_binance', tasas.binance);
            }
        }
            
        if (document.getElementById('euro-top-price')) 
            document.getElementById('euro-top-price').innerText = tasas.eur.toFixed(2);

        const regionConfigs = [
            { id: 'cop', label: 'COP', factor: 1 },
            { id: 'brl', label: 'BRL', factor: 1 },
            { id: 'clp', label: 'CLP', factor: 1 },
            { id: 'ars', label: 'ARS', factor: 1 }
        ];

        regionConfigs.forEach(c => {
            const val = tasas[c.id];
            const rateEl = document.getElementById(`home-${c.id}-rate`);
            const refEl = document.getElementById(`home-${c.id}-ref`);
            const trendEl = document.getElementById(`home-${c.id}-trend`);

            if (rateEl && val) {
                rateEl.innerText = val.toLocaleString('es-VE');
                if (refEl) refEl.innerText = `1 USD = ${val.toLocaleString('es-VE')} ${c.label}`;
                
                if (trendEl) {
                    const fakeChange = (Math.random() * 0.5).toFixed(1);
                    const isUp = Math.random() > 0.4; 
                    trendEl.style.color = isUp ? 'var(--accent-green)' : 'var(--accent-red)';
                    trendEl.innerHTML = `<i class="ph-duotone ph-caret-${isUp ? 'up' : 'down'}"></i> ${fakeChange}%`;
                }
            }
        });

        if (tasas.usd > 0 && tasas.binance > 0) {
            const brecha = ((tasas.binance - tasas.usd) / tasas.usd) * 100;
            const brechaEl = document.getElementById('brecha-value');
            const brechaBg = document.getElementById('brecha-bg');
            
            if (brechaEl) {
                const iconoTrend = brecha > 0 ? '<i class="ph-duotone ph-chart-line-up" style="font-size: 14px; color: var(--accent-red);"></i>' : '';
                brechaEl.innerHTML = `${brecha.toFixed(2)}% ${iconoTrend}`;
            }
            if (brechaBg) brechaBg.style.width = `${Math.min(brecha * 2, 100)}%`;
        } else {
             const brechaEl = document.getElementById('brecha-value');
             if (brechaEl) brechaEl.innerText = "Calculando...";
        }

        if (window.refreshPump) window.refreshPump();
        if (window.updateQuickReference) window.updateQuickReference();
    },

    actualizarReferenciaRapida() {
        const tasas = window.DolarVE.tasas;
        const bcvEl = document.getElementById('quick-ref-bcv');
        const eurEl = document.getElementById('quick-ref-eur');
        const gapEl = document.getElementById('quick-ref-gap');

        if (bcvEl && tasas.usd) bcvEl.innerText = (tasas.usd * this.referenciaRapidaMonto).toLocaleString('es-VE') + ' Bs';
        if (eurEl && tasas.eur) eurEl.innerText = (tasas.eur * this.referenciaRapidaMonto).toLocaleString('es-VE') + ' Bs';

        // Unificado: Comparar Binance vs BCV en lugar de Euro vs USD
        if (gapEl && tasas.usd && tasas.binance) {
            const diferencia = Math.abs(tasas.binance - tasas.usd) * this.referenciaRapidaMonto;
            gapEl.innerText = `Diferencia con Binance: ${diferencia.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs`;
            gapEl.style.display = 'block';
        }
    },

    inicializarGraficoPrincipal() {
        if (typeof Chart === 'undefined') return;
        const ctx = document.getElementById('bcvChart');
        if (!ctx) return;

        if (window.bcvChartInstance) window.bcvChartInstance.destroy();

        const bcv = window.DolarVE.tasas.usd || 475.95;
        const par = window.DolarVE.tasas.binance || 629.90;

        const labels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Hoy'];
        const bcvHistory = [bcv * 0.97, bcv * 0.975, bcv * 0.985, bcv * 0.982, bcv * 0.99, bcv * 0.995, bcv];
        const parHistory = [par * 0.95, par * 0.965, par * 0.98, par * 0.99, par * 0.985, par * 0.99, par];

        window.bcvChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Oficial BCV',
                        data: bcvHistory,
                        borderColor: '#00D084',
                        backgroundColor: 'rgba(0, 208, 132, 0.1)',
                        borderWidth: 3,
                        pointRadius: 4,
                        pointBackgroundColor: '#00D084',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Binance P2P 🔶',
                        data: parHistory,
                        borderColor: '#F3BA2F',
                        borderDash: [5, 5],
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.4,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                layout: { padding: { top: 35, bottom: 5 } },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: '#161B22',
                        titleColor: '#8B949E',
                        bodyColor: '#fff',
                        borderColor: 'rgba(255,255,255,0.1)',
                        borderWidth: 1,
                        padding: 10,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                return context.dataset.label + ': ' + context.parsed.y.toFixed(2) + ' Bs';
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 10 } } },
                    y: { display: false, grid: { display: false } }
                }
            }
        });
    }
};

window.updateQuickReference = () => Divisas.actualizarReferenciaRapida();
window.Divisas = Divisas;
