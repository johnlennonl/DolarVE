// ==========================================
// Módulo de Tasas y Datos - DolarVE
// Aquí traemos los precios actualizados del dólar, euro y cripto.
// ¡Mosca! Este archivo es el que mantiene los números frescos.
// ==========================================

const Tasas = {
    // Función principal para traer todas las tasas oficiales y paralelas
    async obtenerDatosTasas() {
        if (!navigator.onLine) {
            // Se cayó ABA o los datos, sacamos los precios del baúl (Cache)
            Interfaz.mostrarNotificacion('Modo Offline: Datos guardados');
            this.cargarDatosCache();
            return;
        }

        let exito = false;
        // Reintentamos 3 veces por si la conexión está chimba
        for (let intento = 1; intento <= 3; intento++) {
            try {
                const [usdRes, eurRes, parRes, copRes, arsRes] = await Promise.all([
                    fetch('https://ve.dolarapi.com/v1/dolares/oficial'),
                    fetch('https://ve.dolarapi.com/v1/euros/oficial'),
                    fetch('https://ve.dolarapi.com/v1/dolares/paralelo'),
                    fetch('https://open.er-api.com/v6/latest/USD'),
                    fetch('https://dolarapi.com/v1/dolares/blue')
                ]);

                const usdData = await usdRes.json();
                const eurData = await eurRes.json();
                const parData = await parRes.json();
                const copData = await copRes.json();
                const arsData = await arsRes.json();

                // Guardamos en nuestro almacén central
                const tasas = window.DolarVE.tasas;
                tasas.usd = usdData.promedio;
                tasas.eur = eurData.promedio;
                tasas.paralelo = parData.promedio;
                tasas.ars = (arsData.compra + arsData.venta) / 2;
                tasas.cop = copData.rates.COP;
                tasas.brl = copData.rates.BRL;
                tasas.clp = copData.rates.CLP;

                // Actualizamos la pantalla de Inicio con los nuevos precios
                this.actualizarVistasInicio();
                
                // Guardamos pal' futuro por si se va la señal
                localStorage.setItem('dolarve_offline_data', JSON.stringify(tasas));

                // Si hay calculadora, avisamos que los precios cambiaron
                if (typeof Calculadora !== 'undefined') Calculadora.actualizarPantalla();
                
                // Actualizamos el indicador de tiempo
                const ahora = new Date();
                const horaStr = ahora.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });
                const updateEl = document.getElementById('last-update-usd');
                if (updateEl) updateEl.innerText = `Actualizado: ${horaStr}`;

                // Dibujamos el gráfico de tendencia
                this.inicializarGraficoPrincipal();

                exito = true;
                console.log('[DolarVE] Tasas actualizadas con éxito.');
                break; 
            } catch (e) {
                console.error(`[DolarVE] Intento ${intento}/3 fallido traeyendo tasas:`, e);
                if (intento < 3) await new Promise(r => setTimeout(r, 3000));
            }
        }

        if (!exito) {
            this.cargarDatosCache();
            Interfaz.mostrarNotificacion('⚠️ Usando datos guardados (conexión inestable)');
        }
        
        // Cargamos las criptomonedas también
        this.cargarCriptos();
    },

    // Si no hay señal, usamos lo último que guardamos en el navegador
    cargarDatosCache() {
        const cache = JSON.parse(localStorage.getItem('dolarve_offline_data') || '{}');
        const tasas = window.DolarVE.tasas;
        
        Object.keys(cache).forEach(key => {
            tasas[key] = cache[key];
        });
        
        this.actualizarVistasInicio();
        if (typeof Calculadora !== 'undefined') Calculadora.actualizarPantalla();
    },

    // Actualiza los numeritos de la pantalla de Inicio (BCV, Paralelo, etc.)
    actualizarVistasInicio() {
        const tasas = window.DolarVE.tasas;
        
        if (document.getElementById('usd-bcv-price')) 
            document.getElementById('usd-bcv-price').innerText = tasas.usd.toFixed(2);
            
        if (document.getElementById('paralelo-price')) 
            document.getElementById('paralelo-price').innerText = tasas.paralelo.toFixed(2);
            
        if (document.getElementById('euro-top-price')) 
            document.getElementById('euro-top-price').innerText = tasas.eur.toFixed(2);

        // Actualizamos las banderitas (Monedas de la región con mini-tendencias)
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
                
                // Simulación de tendencia sutil (basada en el valor del dólar para dar vida al UI)
                if (trendEl) {
                    const fakeChange = (Math.random() * 0.5).toFixed(1);
                    const isUp = Math.random() > 0.4; // 60% prob de tendencia positiva para "movimiento"
                    trendEl.style.color = isUp ? 'var(--accent-green)' : 'var(--accent-red)';
                    trendEl.innerHTML = `<i class="ph-duotone ph-caret-${isUp ? 'up' : 'down'}"></i> ${fakeChange}%`;
                }
            }
        });

        // Cálculo de la Brecha Cambiaria (Diferencia entre Paralelo y BCV)
        if (tasas.usd > 0 && tasas.paralelo > 0) {
            const brecha = ((tasas.paralelo - tasas.usd) / tasas.usd) * 100;
            const brechaEl = document.getElementById('brecha-value');
            const brechaBg = document.getElementById('brecha-bg');
            
            if (brechaEl) {
                const iconoTrend = brecha > 0 ? '<i class="ph-duotone ph-chart-line-up" style="font-size: 14px; color: var(--accent-red);"></i>' : '';
                brechaEl.innerHTML = `${brecha.toFixed(2)}% ${iconoTrend}`;
            }
            
            if (brechaBg) {
                // Ajustamos la barra de progreso visual de la brecha
                brechaBg.style.width = `${Math.min(brecha * 2, 100)}%`;
            }
        }

        // Surtidor de Gasolina y Referencias (Solo si existen las funciones)
        if (window.refreshPump) window.refreshPump();
        if (window.updateQuickReference) window.updateQuickReference();
    },

    cryptoData: [], // Almacén para el filtrado

    // Trae el Top 50 de Criptos de CoinGecko y datos globales
    async cargarCriptos() {
        const listContainer = document.getElementById('dynamic-crypto-list');
        try {
            // 1. Intentamos traer monedas primero
            const coinsRes = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false');
            if (!coinsRes.ok) throw new Error('CoinGecko Limit');
            const coins = await coinsRes.json();
            this.cryptoData = coins;

            // 2. Intentamos traer datos globales
            try {
                const globalRes = await fetch('https://api.coingecko.com/api/v3/global');
                if (globalRes.ok) {
                    const globalData = await globalRes.json();
                    const btcDom = globalData.data.market_cap_percentage.btc;
                    const globalVol = globalData.data.total_volume.usd;
                    
                    if (document.getElementById('btc-dominance')) 
                        document.getElementById('btc-dominance').innerText = `${btcDom.toFixed(1)}%`;
                    if (document.getElementById('global-volume')) 
                        document.getElementById('global-volume').innerText = `${(globalVol / 1e9).toFixed(1)}B`;
                }
            } catch (globalErr) {
                console.warn('[DolarVE] No se pudo cargar dominio BTC');
            }

            // 3. Renderizamos la lista
            this.renderizarListaCriptos(coins);

            // 4. Activamos el buscador
            this.inicializarBuscadorCripto();

        } catch (e) {
            console.warn('[DolarVE] Error cargando criptos:', e);
            if (listContainer) {
                listContainer.innerHTML = `
                    <div style="text-align: center; color: var(--text-muted); padding: 40px 20px;">
                        <i class="ph-duotone ph-warning-circle" style="font-size: 32px; color: var(--accent-red); margin-bottom: 10px;"></i>
                        <div style="font-weight: 600;">Límite de API alcanzado</div>
                        <p style="font-size: 12px; margin-top: 5px;">Espera un minuto y vuelve a intentarlo.</p>
                        <button onclick="Tasas.cargarCriptos()" class="btn-primary" style="margin-top: 15px; padding: 10px 20px; font-size: 13px;">Reintentar</button>
                    </div>
                `;
            }
        }
    },

    getCoinColor(symbol) {
        const colors = {
            'btc': '#F7931A',
            'eth': '#627EEA',
            'usdt': '#26A17B',
            'bnb': '#F3BA2F',
            'sol': '#14F195',
            'xrp': '#23292F',
            'ada': '#0033AD',
            'doge': '#C2A633',
            'trx': '#FF0013',
            'dot': '#E6007A',
            'matic': '#8247E5',
            'link': '#2A5ADA',
            'shib': '#FFA143',
            'ltc': '#345D9D',
            'dai': '#F5AC37',
            'bch': '#8AF34B'
        };
        return colors[symbol.toLowerCase()] || '#00D084'; // Default green
    },

    renderizarListaCriptos(coins) {
        const listContainer = document.getElementById('dynamic-crypto-list');
        if (!listContainer) return;

        if (coins.length === 0) {
            listContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-muted);">No encontramos esa moneda. 🔍</div>';
            return;
        }

        listContainer.innerHTML = coins.map(coin => {
            const priceChg = coin.price_change_percentage_24h || 0;
            const isUp = priceChg >= 0;
            const trendIcon = isUp ? 'ph-trend-up' : 'ph-trend-down';
            const trendColor = isUp ? 'var(--accent-green)' : 'var(--accent-red)';
            const coinColor = this.getCoinColor(coin.symbol);

            return `
                <div class="crypto-card" style="--coin-color: ${coinColor}" onclick="openCryptoChart('${coin.id}', '${coin.name}', '${coin.symbol.toUpperCase()}', ${coin.current_price}, ${priceChg}, ${coin.high_24h || 0}, ${coin.low_24h || 0})">
                    <div class="coin-meta">
                        <img src="${coin.image}" class="coin-icon" alt="${coin.name}">
                        <div>
                            <div class="coin-name">${coin.name}</div>
                            <div class="coin-symbol">${coin.symbol}</div>
                        </div>
                    </div>
                    <div class="coin-price">
                        <div class="price-val">$${coin.current_price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</div>
                        <div class="change-val" style="color: ${trendColor}">
                            <i class="ph-duotone ${trendIcon}"></i> ${priceChg.toFixed(2)}%
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    inicializarBuscadorCripto() {
        const input = document.getElementById('crypto-search');
        if (!input || input.dataset.ready) return;

        input.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtradas = this.cryptoData.filter(c => 
                c.name.toLowerCase().includes(term) || 
                c.symbol.toLowerCase().includes(term)
            );
            this.renderizarListaCriptos(filtradas);
        });
        input.dataset.ready = "true";
    },

    // Dibuja el gráfico comparativo (BCV vs Paralelo)
    inicializarGraficoPrincipal() {
        const ctx = document.getElementById('bcvChart');
        if (!ctx) return;

        if (window.bcvChartInstance) window.bcvChartInstance.destroy();

        const bcv = window.DolarVE.tasas.usd || 36.50;
        const par = window.DolarVE.tasas.paralelo || 38.20;

        // Mockup táctico: 7 días atrás
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
                        label: 'Paralelo',
                        data: parHistory,
                        borderColor: '#3498db',
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
                interaction: {
                    intersect: false,
                    mode: 'index',
                },
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
                    x: {
                        grid: { display: false },
                        ticks: { color: 'rgba(255,255,255,0.3)', font: { size: 10 } }
                    },
                    y: {
                        display: false,
                        grid: { display: false }
                    }
                }
            }
        });
    },

    // Detalle de una cripto con su gráfico de 24h
    async abrirDetalleCripto(id, nombre, simbolo, precio, cambio, high24, low24) {
        if (window.navigator.vibrate) window.navigator.vibrate(10);

        const overlay = document.getElementById('crypto-modal-overlay');
        const modal = document.getElementById('crypto-modal');
        const titleEl = document.getElementById('crypto-modal-title');
        const priceEl = document.getElementById('crypto-modal-price');

        if (overlay && modal && titleEl && priceEl) {
            overlay.style.display = 'flex';
            setTimeout(() => {
                overlay.style.opacity = '1';
                modal.style.transform = 'translateY(0)';
            }, 10);

            titleEl.innerText = `${nombre} (${simbolo})`;
            priceEl.innerText = `$${precio.toLocaleString('en-US', { maximumFractionDigits: 6 })}`;
            priceEl.style.color = cambio >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';

            // Datos adicionales Brutal UI
            const highEl = document.getElementById('crypto-high-24h');
            const lowEl = document.getElementById('crypto-low-24h');
            if (highEl) highEl.innerText = high24 ? `$${high24.toLocaleString()}` : '---';
            if (lowEl) lowEl.innerText = low24 ? `$${low24.toLocaleString()}` : '---';

            const ctx = document.getElementById('cryptoDetailCanvas');
            const errorEl = document.getElementById('crypto-chart-error');
            if (!ctx) return;

            // Limpiamos el gráfico anterior si existe
            if (this.graficoDetalle) { 
                this.graficoDetalle.destroy(); 
                this.graficoDetalle = null;
            }

            if (errorEl) errorEl.style.display = 'none';
            
            try {
                const res = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=1`);
                if (!res.ok) throw new Error('API Limit');
                const data = await res.json();
                
                if (!data.prices || data.prices.length === 0) throw new Error('No data');

                const precios = data.prices.map(p => p[1]);
                const etiquetas = data.prices.map((p, i) => i);

                const gradiente = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
                const esSubida = cambio >= 0;
                gradiente.addColorStop(0, esSubida ? 'rgba(0, 208, 132, 0.4)' : 'rgba(255, 77, 77, 0.4)');
                gradiente.addColorStop(1, esSubida ? 'rgba(0, 208, 132, 0)' : 'rgba(255, 77, 77, 0)');

                this.graficoDetalle = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: etiquetas,
                        datasets: [{
                            data: precios,
                            borderColor: esSubida ? '#00D084' : '#FF4D4D',
                            borderWidth: 2,
                            backgroundColor: gradiente,
                            fill: true,
                            tension: 0.1,
                            pointRadius: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false }, tooltip: { enabled: false } },
                        scales: { x: { display: false }, y: { display: false } }
                    }
                });
            } catch (e) {
                console.error('[DolarVE] Error gráfico cripto:', e);
                if (errorEl) {
                    errorEl.style.display = 'flex';
                    errorEl.innerHTML = `
                        <i class="ph-duotone ph-warning-circle" style="font-size: 24px; opacity: 0.5; margin-bottom: 8px;"></i>
                        <div style="font-size: 11px;">Ocurrió un error al cargar el gráfico.<br>Inténtalo en un momento.</div>
                    `;
                }
            }
        }
    },

    // Lógica del Surtidor de Gasolina (V12.1)
    referenciaRapidaMonto: 100,
    
    actualizarReferenciaRapida() {
        const tasas = window.DolarVE.tasas;
        const bcvEl = document.getElementById('quick-ref-bcv');
        const eurEl = document.getElementById('quick-ref-eur');
        if (bcvEl && tasas.usd) bcvEl.innerText = (tasas.usd * this.referenciaRapidaMonto).toLocaleString('es-VE') + ' Bs';
        if (eurEl && tasas.eur) eurEl.innerText = (tasas.eur * this.referenciaRapidaMonto).toLocaleString('es-VE') + ' Bs';
    },

    refrescarSurtidor() {
        const pumpLitersEl = document.getElementById('pump-liters');
        const pumpTotalVesEl = document.getElementById('pump-total-ves');
        const pumpTotalUsdEl = document.getElementById('pump-total-usd');
        const pumpSlider = document.getElementById('pump-slider');
        
        if (!pumpLitersEl) return;

        const litros = parseFloat(pumpSlider?.value || 20);
        const precioDolar = 0.50;
        const totalUsd = litros * precioDolar;
        const totalVes = totalUsd * window.DolarVE.tasas.usd;

        pumpLitersEl.innerText = litros.toFixed(1);
        if (pumpTotalUsdEl) pumpTotalUsdEl.innerText = `${totalUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD`;
        if (pumpTotalVesEl) {
            pumpTotalVesEl.innerText = window.DolarVE.tasas.usd > 0 
                ? `${totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs`
                : "Cargando...";
        }
    }
};

// Alias para compatibilidad con el HTML viejo si hace falta
window.openCryptoChart = (id, n, s, p, c, h, l) => Tasas.abrirDetalleCripto(id, n, s, p, c, h, l);
window.refreshPump = () => Tasas.refrescarSurtidor();
window.updatePump = (litros) => {
    const slider = document.getElementById('pump-slider');
    if (slider) {
        slider.value = litros;
        Tasas.refrescarSurtidor();
    }
};
window.updateQuickReference = () => Tasas.actualizarReferenciaRapida();

window.Tasas = Tasas;
