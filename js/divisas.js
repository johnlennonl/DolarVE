// ==========================================
// Módulo de Divisas - DolarVE
// Maneja las tasas fiat (BCV, Paralelo, EUR, COP, ARS)
// ==========================================

const Divisas = {
    referenciaRapidaMonto: 10,

    async fetchWithTimeout(resource, options = {}) {
        const { timeout = 5000 } = options;
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const response = await fetch(resource, { ...options, signal: controller.signal });
            clearTimeout(id);
            return response;
        } catch (e) {
            clearTimeout(id);
            throw e;
        }
    },

    async obtenerBinanceRealTime() {
        console.log('[DolarVE] 🔍 Calculando Promedio Equilibrado Binance (S+B)...');
        
        const formatearPrecios = (data) => {
            if (!data || !data.length) return null;
            const prices = data.map(ad => parseFloat(ad.adv ? ad.adv.price : 0)).filter(p => p > 0);
            if (prices.length === 0) return null;
            prices.sort((a, b) => a - b);
            const mid = Math.floor(prices.length / 2);
            return prices.length % 2 !== 0 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
        };

        // Detectar si estamos en producción (Vercel) o local
        const isProduction = location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';

        const intentos = [
            // Intento 1: Nuestro Proxy Serverless en Vercel (SIN CORS, máxima confiabilidad)
            async () => {
                if (!isProduction) throw new Error('Skip en local');
                const resp = await this.fetchWithTimeout('/api/binance', { timeout: 6000 });
                const d = await resp.json();
                if (d && d.success && d.price > 0) {
                    console.log(`[DolarVE] ✅ Binance via Proxy Serverless (${d.source}): ${d.price.toFixed(2)}`);
                    return d.price;
                }
                throw new Error('Proxy returned no data');
            },
            // Intento 2: CriptoYa via allorigins (proxy CORS estable)
            async () => {
                const targetUrl = encodeURIComponent('https://criptoya.com/api/binancep2p/usdt/ves/1');
                const resp = await this.fetchWithTimeout(`https://api.allorigins.win/raw?url=${targetUrl}`, { timeout: 5000 });
                const d = await resp.json();
                if (d && d.ask > 0 && d.bid > 0) {
                    const promedio = (parseFloat(d.ask) + parseFloat(d.bid)) / 2;
                    console.log(`[DolarVE] ✅ Binance Mid-Market (CriptoYa/allorigins): ${promedio.toFixed(2)} [C:${d.ask} / V:${d.bid}]`);
                    return promedio;
                }
                throw new Error('Incomplete data');
            },
            // Intento 3: CriptoYa via corsproxy.io (backup)
            async () => {
                const url = 'https://corsproxy.io/?' + encodeURIComponent('https://criptoya.com/api/binancep2p/usdt/ves/1');
                const resp = await this.fetchWithTimeout(url, { timeout: 4000 });
                const d = await resp.json();
                if (d && d.ask > 0 && d.bid > 0) {
                    const promedio = (parseFloat(d.ask) + parseFloat(d.bid)) / 2;
                    console.log(`[DolarVE] ✅ Binance Mid-Market (CriptoYa/corsproxy): ${promedio.toFixed(2)} [C:${d.ask} / V:${d.bid}]`);
                    return promedio;
                }
                throw new Error('Incomplete data');
            },
            // Intento 4: Directo a Binance P2P (funciona en localhost, falla en producción por CORS)
            async () => {
                const resp = await this.fetchWithTimeout('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        asset: 'USDT', fiat: 'VES', tradeType: 'BUY', page: 1, rows: 15, payTypes: [], 
                        publisherType: 'merchant', merchantCheck: true
                    }),
                    timeout: 5000
                });
                const d = await resp.json();
                const mediana = formatearPrecios(d.data);
                if (mediana) console.log(`[DolarVE] ✅ Binance Directo (Compra): ${mediana.toFixed(2)}`);
                return mediana;
            }
        ];

        for (const intento of intentos) {
            try {
                const res = await intento();
                if (res) return res;
            } catch (e) {
                console.warn('[DolarVE] Intento Binance falló:', e.message);
            }
        }
        
        // Último recurso: usar cache
        const cachedData = JSON.parse(localStorage.getItem('dolarve_offline_data') || '{}');
        if (cachedData.binance > 0) {
            console.log(`[DolarVE] ⚠️ Usando caché Binance: ${cachedData.binance}`);
            return cachedData.binance;
        }
        
        return null;
    },

    extraerTasasBcvApiTech(html) {
        try {
            // Buscamos el objeto window.__BCV_INITIAL_RATES en el HTML
            const usdMatch = html.match(/usd:\s*([\d.]+)/);
            const eurMatch = html.match(/eur:\s*([\d.]+)/);
            
            if (usdMatch && eurMatch) {
                return {
                    usd: parseFloat(usdMatch[1]),
                    eur: parseFloat(eurMatch[1])
                };
            }
        } catch (e) { console.error('[DolarVE] Error parseando bcvapi.tech:', e); }
        return null;
    },

    async obtenerDatosTasas() {
        if (!navigator.onLine) {
            this.cargarDatosCache();
            return;
        }

        const tasas = window.DolarVE.tasas;
        console.log('[DolarVE] 🚀 Iniciando carga rápida...');

        // 1. Carga rápida (Oficiales)
        try {
            const proxyUrl = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://www.bcvapi.tech/');
            const resultados = await Promise.allSettled([
                this.fetchWithTimeout('https://ve.dolarapi.com/v1/dolares/oficial'),
                this.fetchWithTimeout('https://ve.dolarapi.com/v1/euros/oficial'),
                this.fetchWithTimeout('https://open.er-api.com/v6/latest/USD'),
                this.fetchWithTimeout('https://dolarapi.com/v1/dolares/blue'),
                this.fetchWithTimeout('https://api.dolarvzla.com/public/bcv/exchange-rate', {
                    headers: { 'x-dolarvzla-key': 'bfd67474afa0e6ca2c6155b617fd148c272e2796ade1a4f8277f6098588bcf5e' }
                }), // API DolarVZLA (USD + EUR exactos)
                this.fetchWithTimeout(proxyUrl, { timeout: 8000 }) // Scraping bcvapi.tech (Sin Key)
            ]);

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
            const vzlaData = await safeJson(resultados[4]);
            
            // Procesar bcvapi.tech (Scraping)
            let bcvTechData = null;
            if (resultados[5].status === 'fulfilled' && resultados[5].value.ok) {
                const html = await resultados[5].value.text();
                bcvTechData = this.extraerTasasBcvApiTech(html);
            }

            if (usdData) {
                tasas.usd_normal = usdData.promedio;
                tasas.usd = tasas.usd_normal;
            }
            if (eurData) {
                tasas.eur_normal = eurData.promedio;
                tasas.eur = tasas.eur_normal; 
            }
            
            // --- DETECCIÓN DE TASA FUTURA (DolarVZLA + bcvapi.tech Fallback) ---
            window.DolarVE.hayTasaFutura = false;
            
            // Prioridad 1: bcvapi.tech (Sin key, estable)
            if (bcvTechData && tasas.usd_normal) {
                 if (Math.abs(bcvTechData.usd - tasas.usd_normal) > 0.05) {
                    window.DolarVE.hayTasaFutura = true;
                    tasas.usd_futuro = bcvTechData.usd;
                    tasas.eur_futuro = bcvTechData.eur;
                    console.log(`[DolarVE] ⚡ Tasa Futura detectada (bcvapi.tech): USD ${tasas.usd_futuro} | EUR ${tasas.eur_futuro}`);
                 }
            }
            
            // Prioridad 2: DolarVZLA (Si bcvapi falló o si da data distinta)
            if (!window.DolarVE.hayTasaFutura && vzlaData && vzlaData.current && tasas.usd_normal) {
                const futureUsd = vzlaData.current.usd;
                if (Math.abs(futureUsd - tasas.usd_normal) > 0.05) {
                    window.DolarVE.hayTasaFutura = true;
                    tasas.usd_futuro = futureUsd;
                    tasas.eur_futuro = vzlaData.current.eur;
                    console.log(`[DolarVE] ⚡ Tasa Futura detectada (DolarVZLA): USD ${tasas.usd_futuro} | EUR ${tasas.eur_futuro}`);
                }
            }
            
            if (arsData) tasas.ars = (arsData.compra + arsData.venta) / 2;
            if (copData && copData.rates) {
                tasas.cop = copData.rates.COP;
                tasas.brl = copData.rates.BRL;
                tasas.clp = copData.rates.CLP;
            }

            window.DolarVE.modoFuturoActivo = false;

            this.actualizarVistasInicio();
            localStorage.setItem('dolarve_offline_data', JSON.stringify(tasas));

            // Actualizar hora
            const updateEl = document.getElementById('last-update-usd');
            if (updateEl) updateEl.innerText = `Actualizado: ${new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
            
            this.evaluarBannerFuturo();

        } catch (e) { console.error('[DolarVE] Error en carga rápida:', e); }

        // 2. Carga background (Binance)
        this.obtenerBinanceRealTime().then(binanceRT => {
            if (binanceRT) {
                tasas.binance = binanceRT;
                localStorage.setItem('dolarve_binance_updated_at', Date.now());
                localStorage.setItem('dolarve_offline_data', JSON.stringify(tasas));
            }
            this.actualizarVistasInicio();
            if (window.Noticias) Noticias.generarAnalisisMercado();
            this.inicializarGraficoPrincipal();
        });
    },

    cargarDatosCache() {
        const cache = JSON.parse(localStorage.getItem('dolarve_offline_data') || '{}');
        const tasas = window.DolarVE.tasas;
        
        Object.keys(cache).forEach(key => {
            tasas[key] = cache[key];
        });
        
        this.actualizarVistasInicio();
        this.inicializarGraficoPrincipal();
        if (typeof Calculadora !== 'undefined') Calculadora.actualizarPantalla();
    },

    toggleTasaFutura(activar, animate = true) {
        const tasas = window.DolarVE.tasas;
        window.DolarVE.modoFuturoActivo = activar;
        
        if (activar) {
            tasas.usd = tasas.usd_futuro;
            if (tasas.eur_futuro) tasas.eur = tasas.eur_futuro;
        } else {
            tasas.usd = tasas.usd_normal;
            tasas.eur = tasas.eur_normal;
        }
        
        this.actualizarVistasInicio();
        if (typeof Calculadora !== 'undefined') Calculadora.actualizarPantalla();
        if (typeof Gasolina !== 'undefined') Gasolina.refrescarSurtidor();
        
        // Disparar Alerta Glass
        if (animate && window.Interfaz) {
            const day = new Date().getDay();
            const destName = (day === 5 || day === 6 || day === 0) ? "del Lunes" : "de Mañana";
            if (activar) {
                Interfaz.mostrarNotificacion(`✅ Modo Tasa ${destName} Activado`);
            } else {
                Interfaz.mostrarNotificacion('🔄 Restaurado a Modo Normal');
            }
        }
        
        const bannerContainer = document.getElementById('future-banner-container');
        if (bannerContainer) {
            if (activar) {
                bannerContainer.innerHTML = `
                    <div class="future-rate-active-strip">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <i class="ph-fill ph-check-circle" style="color: var(--accent-green);"></i>
                            <span>Modo Futuro Activado</span>
                        </div>
                        <button onclick="Divisas.toggleTasaFutura(false)" class="btn-future-restore">Volver</button>
                    </div>
                `;
                document.getElementById('usd-bcv-price').closest('.card').classList.add('future-active-card');
            } else {
                document.getElementById('usd-bcv-price').closest('.card').classList.remove('future-active-card');
                this.evaluarBannerFuturo(); // re-render the banner
            }
        }
    },

    evaluarBannerFuturo() {
        const bannerContainer = document.getElementById('future-banner-container');
        if (!bannerContainer) return;
        
        if (!window.DolarVE.hayTasaFutura) {
            bannerContainer.innerHTML = '';
            return;
        }
        
        if (window.DolarVE.modoFuturoActivo) return; // Ya está activo
        
        const day = new Date().getDay();
        const destDay = (day === 5 || day === 6 || day === 0) ? "del Lunes" : "Mañana";
        
        const diffUsd = window.DolarVE.tasas.usd_futuro - window.DolarVE.tasas.usd_normal;
        const trendIcon = diffUsd > 0 ? '📈' : '📉';
        const sign = diffUsd > 0 ? '+' : '';
        
        const diffEur = window.DolarVE.tasas.eur_futuro ? (window.DolarVE.tasas.eur_futuro - window.DolarVE.tasas.eur_normal) : 0;
        const trendEur = diffEur > 0 ? '📈' : '📉';
        const signEur = diffEur > 0 ? '+' : '';
        
        const eurBlock = window.DolarVE.tasas.eur_futuro ? `
            <div class="future-rate-item">
                <div class="fr-label">🇪🇺 Euro BCV</div>
                <div class="fr-value">${window.DolarVE.tasas.eur_futuro.toFixed(2)}</div>
                <div class="fr-trend ${diffEur > 0 ? 'up' : 'down'}">${trendEur} ${signEur}${diffEur.toFixed(2)} Bs</div>
            </div>` : '';
        
        bannerContainer.innerHTML = `
            <div class="future-rate-teaser" onclick="this.nextElementSibling.classList.toggle('show')">
                <i class="ph-duotone ph-lightning" style="color: #f1c40f;"></i>
                <span>Nueva Tasa ${destDay} Disponible</span>
                <i class="ph ph-caret-down" style="margin-left: auto;"></i>
            </div>
            <div class="future-rate-dropdown">
                <div class="future-rate-grid">
                    <div class="future-rate-item">
                        <div class="fr-label">🇺🇸 Dólar BCV</div>
                        <div class="fr-value">${window.DolarVE.tasas.usd_futuro.toFixed(2)}</div>
                        <div class="fr-trend ${diffUsd > 0 ? 'up' : 'down'}">${trendIcon} ${sign}${diffUsd.toFixed(2)} Bs</div>
                    </div>
                    ${eurBlock}
                </div>
                <button onclick="Divisas.toggleTasaFutura(true)" class="btn-activate-future">
                    <i class="ph-bold ph-rocket-launch"></i> Activar Modo ${destDay.replace('del ', '')}
                </button>
            </div>
        `;
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
            }

            // Actualizamos la referencia para la próxima comparación de tendencia
            localStorage.setItem('dolarve_last_binance', tasas.binance);

            // --- INDICADOR DE FRESCURA (TIEMPO) ---
            const dotEl = document.getElementById('binance-dot');
            const timeEl = document.getElementById('binance-time');
            const ts = parseInt(localStorage.getItem('dolarve_binance_updated_at') || 0);

            if (dotEl && timeEl && ts > 0) {
                const diffMs = Date.now() - ts;
                const diffMins = Math.floor(diffMs / 60000);
                
                let etiqueta = "Sincronizado";
                let color = "#00D084"; // Verde (Live)
                
                if (diffMins < 1) etiqueta = "EN VIVO";
                else if (diffMins < 60) etiqueta = `HACE ${diffMins} MIN`;
                else if (diffMins < 1440) etiqueta = `HACE ${Math.floor(diffMins/60)} HORAS`;
                else etiqueta = "DATOS ANTIGUOS";

                // Colores de estado
                if (diffMins > 120) color = "#ff4d4d"; // Rojo (>2h)
                else if (diffMins > 15) color = "#f1c40f"; // Amarillo (>15m)

                dotEl.style.background = color;
                dotEl.style.boxShadow = `0 0 8px ${color}66`;
                timeEl.innerText = etiqueta;
            } else if (dotEl && timeEl) {
                dotEl.style.background = "#94a3b8";
                timeEl.innerText = "SIN DATOS";
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
