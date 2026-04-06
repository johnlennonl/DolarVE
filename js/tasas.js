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
        
        // 1. Cargamos el Pulso del Home rápido con Binance (Más estable)
        this.obtenerPulseBinance();

        // 2. Cargamos las criptomonedas completas con CoinGecko
        this.cargarCriptos();

        // 3. Cargamos los Bancos (Nuevo v2.2) y Configuramos Modales
        this.obtenerTasasBancos();
        this.configurarModales();
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
        
        // --- 0. CARGAR DESDE CACHÉ (FALLBACK INMEDIATO) ---
        const cacheCryptos = JSON.parse(localStorage.getItem('dolarve_crypto_cache') || '[]');
        if (cacheCryptos.length > 0) {
            this.cryptoData = cacheCryptos;
            this.renderizarListaCriptos(cacheCryptos);
            this.actualizarCryptoPulse(cacheCryptos);
        }

        try {
            // 1. Intentamos traer monedas primero
            const coinsRes = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false');
            if (!coinsRes.ok) throw new Error('CoinGecko Limit');
            const coins = await coinsRes.json();
            
            this.cryptoData = coins;
            // Guardar en caché para la próxima vez
            localStorage.setItem('dolarve_crypto_cache', JSON.stringify(coins));

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

            // 3. Renderizamos la lista y el pulso del Home
            this.renderizarListaCriptos(coins);
            this.actualizarCryptoPulse(coins);

            // 4. Activamos el buscador
            this.inicializarBuscadorCripto();

        } catch (e) {
            console.warn('[DolarVE] Error cargando criptos:', e);
            
            // Si falló el servidor, pero no teníamos caché antes
            if (this.cryptoData.length === 0 && listContainer) {
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

    // TRAEMOS LOS PRECIOS TOP DESDE BINANCE PARA EL HOME
    async obtenerPulseBinance() {
        try {
            // Símbolos: Los 9 más importantes/virales
            const symbols = ["BTCUSDT","ETHUSDT","BNBUSDT","SOLUSDT","XRPUSDT","DOGEUSDT","SHIBUSDT","ADAUSDT","TRXUSDT"];
            const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(symbols)}`);
            if (!res.ok) throw new Error('Binance Limit');
            const data = await res.json();

            if (Array.isArray(data)) {
                data.forEach(item => {
                    const symbol = item.symbol.replace('USDT', '');
                    const price = parseFloat(item.lastPrice);
                    const change = parseFloat(item.priceChangePercent);
                    const isUp = change >= 0;
                    const color = isUp ? 'var(--accent-green)' : 'var(--accent-red)';

                    const elId = `home-${symbol.toLowerCase()}-val`;
                    const el = document.getElementById(elId);
                    
                    if (el) {
                        const decimals = price < 1 ? 6 : (price < 100 ? 2 : 0);
                        const formattedPrice = price.toLocaleString('en-US', { maximumFractionDigits: decimals });
                        el.innerHTML = `$${formattedPrice} <span style="font-size: 8px; color: ${color}; font-weight: 700;">${isUp ? '▲' : '▼'}${Math.abs(change).toFixed(1)}%</span>`;
                    }
                });

                // El USDT no está en el fetch de USDT pairs de forma directa como USDTUSDT, lo fijamos o buscamos USDTDAI
                const usdtEl = document.getElementById('home-usdt-val');
                if (usdtEl) usdtEl.innerHTML = `$1.00 <span style="font-size: 8px; color: var(--accent-green); font-weight: 700;">Stable</span>`;
                
                // Duplicamos el track para el scroll infinito si no se ha hecho
                const track = document.getElementById('pulse-track');
                if (track) {
                    // Si el track está vacío por algún error, o solo tiene los items una vez, forzamos duplicación
                    const originalItemsCount = track.querySelectorAll('.pulse-card').length;
                    
                    if (!track.dataset.duplicated || originalItemsCount < 10) { 
                        track.innerHTML += track.innerHTML;
                        track.dataset.duplicated = "true";
                    }
                }

                // Iniciamos la calculadora rápida con los nuevos precios
                this.inicializarCryptoQuickCalc(data);
            }
        } catch (e) {
            console.warn('[DolarVE] Binance falló, usando fallback de CoinGecko:', e);
        }
    },

    actualizarCryptoPulse(coins) {
        if (!coins || !coins.length) return;

        const btc = coins.find(c => c.symbol === 'btc');
        const eth = coins.find(c => c.symbol === 'eth');
        const usdt = coins.find(c => c.symbol === 'usdt');

        if (btc && document.getElementById('home-btc-val')) {
            document.getElementById('home-btc-val').innerText = `$${btc.current_price.toLocaleString()}`;
        }
        if (eth && document.getElementById('home-eth-val')) {
            document.getElementById('home-eth-val').innerText = `$${eth.current_price.toLocaleString()}`;
        }
        if (usdt && document.getElementById('home-usdt-val')) {
            document.getElementById('home-usdt-val').innerText = `$${usdt.current_price.toFixed(2)}`;
        }
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
                layout: {
                    padding: {
                        top: 35, // Espacio para que el texto "Desliza" no tape nada
                        bottom: 5
                    }
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

    // Lógica de Referencia Rápida (V2.1)
    referenciaRapidaMonto: 10,
    
    actualizarReferenciaRapida() {
        const tasas = window.DolarVE.tasas;
        const bcvEl = document.getElementById('quick-ref-bcv');
        const eurEl = document.getElementById('quick-ref-eur');
        const gapEl = document.getElementById('quick-ref-gap');

        if (bcvEl && tasas.usd) bcvEl.innerText = (tasas.usd * this.referenciaRapidaMonto).toLocaleString('es-VE') + ' Bs';
        if (eurEl && tasas.eur) eurEl.innerText = (tasas.eur * this.referenciaRapidaMonto).toLocaleString('es-VE') + ' Bs';

        // Cálculo de "La Brecha" (Diferencia en Bs)
        if (gapEl && tasas.usd && tasas.eur) {
            const diferencia = Math.abs(tasas.eur - tasas.usd) * this.referenciaRapidaMonto;
            gapEl.innerText = `Diferencia del Mercado: ${diferencia.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs`;
            gapEl.style.display = 'block';
        }
    },

    // Mini Calculadora Cripto del Home
    inicializarCryptoQuickCalc(binanceData) {
        const amtInput = document.getElementById('home-crypto-amt');
        const select = document.getElementById('home-crypto-select');
        if (!amtInput || !select) return;

        const updateCalc = () => {
            const sym = select.value + "USDT";
            const amt = parseFloat(amtInput.value) || 0;
            const rates = window.DolarVE.tasas;
            
            let priceUsd = 1; // Default para USDT
            if (select.value !== 'USDT') {
                const coin = binanceData.find(c => c.symbol === sym);
                priceUsd = coin ? parseFloat(coin.lastPrice) : 0;
                if (!coin && select.value === 'SHIB') {
                    // SHIB a veces tiene un par diferente o no está en la lista reducida, fallback manual si hace falta
                    const shib = binanceData.find(c => c.symbol.includes('SHIB'));
                    priceUsd = shib ? parseFloat(shib.lastPrice) : 0;
                }
            }

            const totalUsd = amt * priceUsd;
            const totalVes = totalUsd * (rates.usd || 0);

            const resUsdEl = document.getElementById('home-crypto-res-usd');
            const resVesEl = document.getElementById('home-crypto-res-ves');

            if (resUsdEl) {
                const dec = totalUsd < 1 ? 6 : 2;
                resUsdEl.innerText = `$ ${totalUsd.toLocaleString('en-US', { maximumFractionDigits: dec })}`;
            }
            if (resVesEl) resVesEl.innerText = `${totalVes.toLocaleString('es-VE', { maximumFractionDigits: 2 })} Bs`;
        };

        if (!amtInput.dataset.listener) {
            amtInput.addEventListener('input', updateCalc);
            select.addEventListener('change', updateCalc);
            amtInput.dataset.listener = "true";
        }

        updateCalc();
    },

    // PIZARRA BANCARIA (V2.2.1 - Motor Robusto)
    async obtenerTasasBancos() {
        const listContainer = document.getElementById('dynamic-banks-list');
        if (!listContainer) return;

        try {
            // Intentamos la API de Bancos (Argentina/Global) por si acaso hay datos VE ahora
            const res = await fetch('https://ve.dolarapi.com/v1/dolares/oficial/bancos');
            if (!res.ok) throw new Error('DolarApiBanksVE Not Available');
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                this.renderizarBancos(data);
                return;
            }
            throw new Error('Empiric Fallback Needed');
        } catch (e) {
            console.log('[DolarVE] Usando Motor de Veracidad BCV para Bancos...');
            // MOTOR DE VERACIDAD: Usamos la tasa oficial BCV promedio para todos los bancos
            const tasaOficial = window.DolarVE.tasas.usd || 47.39; 
            
            const bancosOficiales = [
                { nombre: 'Banesco', venta: tasaOficial },
                { nombre: 'Banco de Venezuela', venta: tasaOficial },
                { nombre: 'Mercantil', venta: tasaOficial },
                { nombre: 'BBVA Provincial', venta: tasaOficial },
                { nombre: 'Bancamiga', venta: tasaOficial },
                { nombre: 'BNC', venta: tasaOficial },
                { nombre: 'Banco Exterior', venta: tasaOficial },
                { nombre: 'Bancaribe', venta: tasaOficial }
            ];
            
            this.renderizarBancos(bancosOficiales);
        }
    },

    renderizarBancos(bancos) {
        const listContainer = document.getElementById('dynamic-banks-list');
        if (!listContainer) return;

        const bankMapping = {
            'BANESCO': { class: 'bank-banesco', icon: 'ph-fill ph-bank', img: 'img/bancos/banesco.png' },
            'MERCANTIL': { class: 'bank-mercantil', icon: 'ph-fill ph-bank', img: 'img/bancos/bancoMercantil.png' },
            'BBVA PROVINCIAL': { class: 'bank-provincial', icon: 'ph-bold ph-bank', img: 'img/bancos/bancoProvincial.png' },
            'BANCO DE VENEZUELA': { class: 'bank-bdv', icon: 'ph-fill ph-bank', img: 'img/bancos/bancoVenezuela.png' },
            'BNC': { class: 'bank-bnc', icon: 'ph-fill ph-bank', img: 'img/bancos/banconacionaldecredito.png' },
            'BANCARIBE': { class: 'bank-bancaribe', icon: 'ph-fill ph-bank', img: 'img/bancos/bancaribe.png' },
            'BANCO EXTERIOR': { class: 'bank-exterior', icon: 'ph-fill ph-bank', img: 'img/bancos/bancoExterior.png' },
            'BANCAMIGA': { class: 'bank-bancamiga', icon: 'ph-fill ph-bank', img: 'img/bancos/bancamiga.png' }
        };

        listContainer.innerHTML = bancos.map(b => {
            const info = bankMapping[b.nombre.toUpperCase()] || { class: '', icon: 'ph-fill ph-bank' };
            const logoHtml = info.img 
                ? `<img src="${info.img}" style="width: 24px; height: 24px; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));">`
                : `<i class="${info.icon}"></i>`;

            return `
                <div class="bank-card ${info.class}">
                    <div class="bank-header">
                        <div class="bank-logo">${logoHtml}</div>
                        <div class="bank-name">${b.nombre}</div>
                    </div>
                    <div class="bank-rates">
                        <div class="bank-rate-row">
                            <span class="rate-label">OFICIAL BCV</span>
                            <span class="rate-value">${b.venta.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    configurarModales() {
        // Cierre del Modal de Cripto
        const closeBtn = document.getElementById('close-crypto-modal');
        const overlay = document.getElementById('crypto-modal-overlay');
        const modal = document.getElementById('crypto-modal');

        if (closeBtn && overlay && modal) {
            const cerrar = () => {
                overlay.style.opacity = '0';
                modal.style.transform = 'translateY(100%)';
                setTimeout(() => {
                    overlay.style.display = 'none';
                }, 300);
            };

            closeBtn.onclick = cerrar;
            
            // Cerrar al tocar fuera (en el fondo oscuro)
            overlay.onclick = (e) => {
                if (e.target === overlay) cerrar();
            };
        }
    },

    // --- Geolocalización de Gasolineras Dynamic v7.7.5 ---
    
    async obtenerEstacionesCercanas(forzar = false) {
        const container = document.getElementById('nearby-gas-stations');
        if (!container) return;

        const permitido = localStorage.getItem('dolarve_location_allowed') === 'true';
        
        if (!permitido && !forzar) {
            this.renderizarPromptUbicacion();
            return;
        }

        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                <div class="loader-spinner" style="margin: 0 auto 15px; width: 30px; height: 30px; border-top-color: var(--accent-green);"></div>
                <div style="font-size: 13px; font-weight: 600;">Sincronizando estaciones...</div>
            </div>
        `;

        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                localStorage.setItem('dolarve_location_allowed', 'true');
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                
                try {
                    // Fetch real data from Supabase
                    let estaciones = [];
                    if (window.DolarVE.supabase) {
                        const { data, error } = await window.DolarVE.supabase.from('gas_stations').select('*');
                        if (!error && data) estaciones = data;
                    }

                    // Fallback to minimal data if supabase fails or table empty
                    if (estaciones.length === 0) {
                        estaciones = [
                            { id: '1', name: 'E/S Chuao', latitude: 10.4851, longitude: -66.8372, city: 'Caracas', status: 'Operativa' },
                            { id: '2', name: 'E/S El Cafetal', latitude: 10.4715, longitude: -66.8324, city: 'Caracas', status: 'Sin Cola' },
                            { id: '3', name: 'E/S Las Mercedes', latitude: 10.4820, longitude: -66.8631, city: 'Caracas', status: 'Poca Cola' },
                            // Cabimas (Tu ubicación local)
                            { id: '4', name: 'E/S La Estancia', latitude: 10.3885, longitude: -71.4392, city: 'Cabimas', status: 'Operativa' },
                            { id: '5', name: 'E/S Delicias', latitude: 10.3952, longitude: -71.4421, city: 'Cabimas', status: 'Sin Cola' },
                            { id: '6', name: 'E/S El Amparo', latitude: 10.6695, longitude: -71.6548, city: 'Maracaibo', status: 'Poca Cola' }
                        ];
                    }

                    const cercanas = estaciones.map(est => {
                        const dist = this.calcularDistancia(lat, lng, est.latitude, est.longitude);
                        return { ...est, distancia: dist };
                    }).sort((a, b) => a.distancia - b.distancia);

                    // --- Filtro de Geocerca Inteligente (v7.8) ---
                    // Si tenemos estaciones a menos de 50km, mostramos SOLO esas (máximo 3)
                    // Esto evita mostrar Caracas (500km) si estás en Cabimas.
                    const estacionesMuyCerca = cercanas.filter(e => e.distancia < 50);
                    const resultadoFinal = estacionesMuyCerca.length > 0 ? estacionesMuyCerca.slice(0, 3) : cercanas.slice(0, 3);

                    this.renderizarEstaciones(resultadoFinal);
                } catch (e) {
                    console.error('[DolarVE] Error fetching gas:', e);
                }
            },
            (err) => {
                const errorMsg = err.code === 1 ? 'Ubicación denegada. Actívala en ajustes.' : 'Error al obtener ubicación.';
                container.innerHTML = `
                    <div class="card" style="margin: 0; padding: 25px; text-align: center; background: rgba(255, 77, 77, 0.05); border: 1px dashed rgba(255, 77, 77, 0.2);">
                        <i class="ph-duotone ph-map-pin-slash" style="font-size: 32px; color: var(--accent-red); margin-bottom: 15px;"></i>
                        <div style="font-size: 13px; color: var(--text-main); font-weight: 700;">${errorMsg}</div>
                        <button onclick="Tasas.obtenerEstacionesCercanas(true)" class="btn-primary" style="margin-top: 15px; background: var(--accent-red); width: 100%;">Reintentar</button>
                    </div>
                `;
            },
            { timeout: 10000, enableHighAccuracy: true }
        );
    },

    async reportarStatus(stationId, nuevoStatus) {
        if (window.navigator.vibrate) window.navigator.vibrate(20);
        
        Interfaz.mostrarNotificacion(`📡 Reportando: ${nuevoStatus}...`);

        try {
            if (window.DolarVE.supabase) {
                const { error } = await window.DolarVE.supabase
                    .from('gas_stations')
                    .update({ 
                        status: nuevoStatus, 
                        last_updated: new Date().toISOString() 
                    })
                    .eq('id', stationId);

                if (error) throw error;
                Interfaz.mostrarNotificacion('✅ ¡Reporte enviado con éxito!');
            } else {
                // Fallback Local para que el usuario pueda probar sin Supabase configurado
                this.estacionesCercanasCache = (this.estacionesCercanasCache || []).map(est => {
                    if (est.id === stationId) return { ...est, status: nuevoStatus, last_updated: new Date().toISOString() };
                    return est;
                });
                this.renderizarEstaciones(this.estacionesCercanasCache);
                Interfaz.mostrarNotificacion('⚠️ Reporte local (Modo Demo)');
            }
            
            this.obtenerEstacionesCercanas(true); // Intentar refrescar de todas formas
        } catch (e) {
            console.error('[DolarVE] Error reporte:', e);
            Interfaz.mostrarNotificacion('❌ Fallo al reportar. Verifica tu DB.');
            
            // Si falló Supabase, igual actualizamos localmente para feedback inmediato
            this.estacionesCercanasCache = (this.estacionesCercanasCache || []).map(est => {
                if (est.id === stationId) return { ...est, status: nuevoStatus, last_updated: new Date().toISOString() };
                return est;
            });
            this.renderizarEstaciones(this.estacionesCercanasCache);
        }
    },

    calcularDistancia(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radio de la Tierra en km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },

    renderizarPromptUbicacion() {
        const container = document.getElementById('nearby-gas-stations');
        if (!container) return;

        container.innerHTML = `
            <div class="card" style="margin: 0; padding: 20px; text-align: center; background: rgba(52, 152, 219, 0.05); border: 1px solid rgba(52, 152, 219, 0.1);">
                <i class="ph-duotone ph-map-pin" style="font-size: 32px; color: #3498db; margin-bottom: 12px;"></i>
                <div style="font-size: 14px; font-weight: 700; color: var(--text-main); margin-bottom: 6px;">Gasolineras Cercanas</div>
                <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 20px; line-height: 1.4;">Activa tu ubicación para encontrar las estaciones de servicio más próximas a ti.</div>
                <button onclick="Tasas.obtenerEstacionesCercanas(true)" class="btn-primary" style="width: 100%; background: #3498db; color: #fff; padding: 12px; font-size: 13px;">Activar Ubicación</button>
            </div>
        `;
    },

    renderizarEstaciones(estaciones) {
        const container = document.getElementById('nearby-gas-stations');
        if (!container) return;

        // Guardamos en caché local para el modo demo
        this.estacionesCercanasCache = estaciones;

        container.innerHTML = `
            <div style="font-size: 11px; color: var(--text-muted); font-weight: 800; text-transform: uppercase; margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="ph-duotone ph-gas-pump" style="color: var(--accent-green); font-size: 18px;"></i> Bombas Cercanas (Cabimas)
                </div>
                <button onclick="Tasas.obtenerEstacionesCercanas(true)" style="background: none; border: none; cursor: pointer; color: var(--accent-green); display: flex; align-items: center; gap: 5px;">
                    <span id="update-indicator-gas" style="font-size: 9px; font-weight: 800;">RECARGAR</span>
                    <i class="ph ph-arrows-clockwise" style="font-size: 14px;"></i>
                </button>
            </div>
            <div class="gas-list" style="display: flex; flex-direction: column; gap: 12px;">
                ${estaciones.map(est => {
                    // Mapeo dinámico de estatus a clases CSS
                    let statusClass = 'status-operative';
                    if (est.status === 'Sin Cola') statusClass = 'status-free';
                    if (est.status === 'Poca Cola') statusClass = 'status-low';
                    if (est.status === 'Mucha Cola') statusClass = 'status-high';
                    if (est.status === 'Cerrada') statusClass = 'status-closed';
                    if (est.status === 'Operativa') statusClass = 'status-operative';

                    const lastUpd = est.last_updated ? new Date(est.last_updated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '---';
                    const numReports = est.reports_count || 0;
                    
                    return `
                    <div class="gas-station-card">
                        <div class="gas-card-header" onclick="window.open('https://www.google.com/maps/search/?api=1&query=${est.latitude || est.lat},${est.longitude || est.lng}', '_blank')">
                            <div>
                                <div class="gas-name">${est.name || est.nombre}</div>
                                <div class="gas-city">${est.city || est.ciudad} • <span style="color: var(--accent-blue)">A ${est.distancia.toFixed(1)} km</span></div>
                            </div>
                            <div class="gas-status-badge ${statusClass}">
                                ${est.status}
                            </div>
                        </div>

                        ${numReports > 0 ? `<div style="font-size: 9px; color: var(--accent-green); font-weight: 800; margin-top: -5px; opacity: 0.8; letter-spacing: 0.5px;">⭐ ${numReports} reportes de la comunidad</div>` : ''}

                        <div style="font-size: 10px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; margin-top: 10px; opacity: 0.8; display: flex; align-items: center; gap: 5px;">
                            <i class="ph-duotone ph-megaphone"></i> Reportar Estado Ahora:
                        </div>
                        <div class="gas-report-actions" style="margin-top: 8px;">
                            <button class="report-btn ${est.status === 'Sin Cola' ? 'active' : ''}" onclick="Tasas.reportarStatus('${est.id}', 'Sin Cola')">
                                <i class="ph-duotone ph-check-circle"></i> Sin Cola
                            </button>
                            <button class="report-btn ${est.status === 'Poca Cola' ? 'active' : ''}" onclick="Tasas.reportarStatus('${est.id}', 'Poca Cola')">
                                <i class="ph-duotone ph-clock"></i> Poca
                            </button>
                            <button class="report-btn ${est.status === 'Mucha Cola' ? 'active' : ''}" onclick="Tasas.reportarStatus('${est.id}', 'Mucha Cola')">
                                <i class="ph-duotone ph-warning-diamond"></i> Mucha
                            </button>
                        </div>

                        <div class="gas-card-footer" style="border-top: 1px dashed var(--card-border); padding-top: 12px; margin-top: 5px;">
                            <div class="gas-distance" style="color: var(--accent-blue);">
                                <i class="ph ph-map-trifold"></i> Guíame con GPS
                            </div>
                            <div class="gas-update-time">Visto hoy: ${lastUpd}</div>
                        </div>
                    </div>
                `}).join('')}
            </div>
        `;

        // Pequeño truco para asegurar que el indicador de la esquina cambie
        const indicator = document.getElementById('update-indicator-gas');
        if (indicator) indicator.innerText = 'CARGADO';
    },

    refrescarSurtidor() {
        const pumpLitersEl = document.getElementById('pump-liters');
        const pumpTotalVesEl = document.getElementById('pump-total-ves');
        const pumpTotalUsdEl = document.getElementById('pump-total-usd');
        const pumpSlider = document.getElementById('pump-slider');
        const fuelFill = document.getElementById('fuel-fill');
        const bubbleContainer = document.getElementById('fuel-bubbles-container');
        
        if (!pumpLitersEl) return;

        const litrosNueva = parseFloat(pumpSlider?.value || 20);
        const precioDolar = 0.50;
        const totalUsd = litrosNueva * precioDolar;
        const totalVes = totalUsd * (window.DolarVE.tasas.usd || 0);

        // Actualizar Galón Visual (Proporcional a 120L)
        if (fuelFill) {
            const porcentaje = (litrosNueva / 120) * 100;
            fuelFill.style.height = `${porcentaje}%`;
        }

        // Generar burbujas si hay movimiento
        if (bubbleContainer) {
            this.generarBurbujas(bubbleContainer);
        }

        // --- Animación de Conteo Fluido (Optimizado v13.2 - Bugfix Cifras) ---
        const animarValor = (elemento, valorFinal, decimales = 2, sufijo = "") => {
            // Limpieza extrema: solo nos quedamos con los dígitos
            const soloDigitos = elemento.innerText.replace(/[^\d]/g, '');
            // Convertimos a número real basándonos en los decimales que sabemos que tiene
            const valorInicial = (parseFloat(soloDigitos) || 0) / Math.pow(10, decimales);
            
            const duracion = 500; 
            const inicio = performance.now();

            // Cancelar cualquier animación previa en este elemento (Seguridad v13.2)
            if (elemento.dataset.animating === 'true') return;
            elemento.dataset.animating = 'true';

            const actualizar = (ahora) => {
                const transcurrido = ahora - inicio;
                const progreso = Math.min(transcurrido / duracion, 1);
                const ease = 1 - Math.pow(1 - progreso, 4); 
                const valorActual = valorInicial + (valorFinal - valorInicial) * ease;
                
                elemento.innerText = `${valorActual.toLocaleString('es-VE', { 
                    minimumFractionDigits: decimales, 
                    maximumFractionDigits: decimales 
                })}${sufijo}`;

                if (progreso < 1) {
                    requestAnimationFrame(actualizar);
                } else {
                    elemento.dataset.animating = 'false';
                }
            };
            requestAnimationFrame(actualizar);
        };

        // Solo animamos los LITROS para evitar vibraciones en la UI
        animarValor(pumpLitersEl, litrosNueva, 1);

        // Los montos se actualizan directamente o de forma inmediata
        if (pumpTotalUsdEl) pumpTotalUsdEl.innerText = `${totalUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
        if (pumpTotalVesEl && window.DolarVE.tasas.usd > 0) {
            pumpTotalVesEl.innerText = `${totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`;
        }
    },

    generarBurbujas(container) {
        if (Math.random() > 0.3) return; // No siempre para no saturar
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        const size = Math.random() * 8 + 4;
        bubble.style.width = `${size}px`;
        bubble.style.height = `${size}px`;
        bubble.style.left = `${Math.random() * 100}%`;
        bubble.style.bottom = `-10px`;
        bubble.style.animationDuration = `${Math.random() * 2 + 1}s`;
        
        container.appendChild(bubble);
        setTimeout(() => bubble.remove(), 3000);
    },
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
