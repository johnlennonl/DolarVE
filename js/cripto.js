// ==========================================
// Módulo Cripto - DolarVE
// Maneja peticiones a CoinGecko, Binance y la UI de criptos
// ==========================================

const Cripto = {
    cryptoData: [],

    async cargarCriptos() {
        const listContainer = document.getElementById('dynamic-crypto-list');
        const cacheCryptos = JSON.parse(localStorage.getItem('dolarve_crypto_cache') || '[]');
        
        if (cacheCryptos.length > 0) {
            this.cryptoData = cacheCryptos;
            this.renderizarListaCriptos(cacheCryptos);
            this.actualizarCryptoPulse(cacheCryptos);
        }

        try {
            const coinsRes = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false');
            if (!coinsRes.ok) throw new Error('CoinGecko Limit');
            const coins = await coinsRes.json();
            
            this.cryptoData = coins;
            localStorage.setItem('dolarve_crypto_cache', JSON.stringify(coins));

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

            this.renderizarListaCriptos(coins);
            this.actualizarCryptoPulse(coins);
            this.inicializarBuscadorCripto();

        } catch (e) {
            console.warn('[DolarVE] Error cargando criptos:', e);
            if (this.cryptoData.length === 0 && listContainer) {
                listContainer.innerHTML = `
                    <div style="text-align: center; color: var(--text-muted); padding: 40px 20px;">
                        <i class="ph-duotone ph-warning-circle" style="font-size: 32px; color: var(--accent-red); margin-bottom: 10px;"></i>
                        <div style="font-weight: 600;">Límite de API alcanzado</div>
                        <p style="font-size: 12px; margin-top: 5px;">Espera un minuto y vuelve a intentarlo.</p>
                        <button onclick="Cripto.cargarCriptos()" class="btn-primary" style="margin-top: 15px; padding: 10px 20px; font-size: 13px;">Reintentar</button>
                    </div>
                `;
            }
        }
    },

    getCoinColor(symbol) {
        const colors = {
            'btc': '#F7931A', 'eth': '#627EEA', 'usdt': '#26A17B', 'bnb': '#F3BA2F',
            'sol': '#14F195', 'xrp': '#23292F', 'ada': '#0033AD', 'doge': '#C2A633',
            'trx': '#FF0013', 'dot': '#E6007A', 'matic': '#8247E5', 'link': '#2A5ADA',
            'shib': '#FFA143', 'ltc': '#345D9D', 'dai': '#F5AC37', 'bch': '#8AF34B'
        };
        return colors[symbol.toLowerCase()] || '#00D084';
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
                <div class="crypto-card" style="--coin-color: ${coinColor}" onclick="window.openCryptoChart('${coin.id}', '${coin.name}', '${coin.symbol.toUpperCase()}', ${coin.current_price}, ${priceChg}, ${coin.high_24h || 0}, ${coin.low_24h || 0})">
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

    async obtenerPulseBinance() {
        try {
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

                const usdtEl = document.getElementById('home-usdt-val');
                if (usdtEl) usdtEl.innerHTML = `$1.00 <span style="font-size: 8px; color: var(--accent-green); font-weight: 700;">Stable</span>`;
                
                const track = document.getElementById('pulse-track');
                if (track) {
                    const originalItemsCount = track.querySelectorAll('.pulse-card').length;
                    if (!track.dataset.duplicated || originalItemsCount < 10) { 
                        track.innerHTML += track.innerHTML;
                        track.dataset.duplicated = "true";
                    }
                }

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

            const highEl = document.getElementById('crypto-high-24h');
            const lowEl = document.getElementById('crypto-low-24h');
            if (highEl) highEl.innerText = high24 ? `$${high24.toLocaleString()}` : '---';
            if (lowEl) lowEl.innerText = low24 ? `$${low24.toLocaleString()}` : '---';

            const ctx = document.getElementById('cryptoDetailCanvas');
            const errorEl = document.getElementById('crypto-chart-error');
            if (!ctx) return;

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

    inicializarCryptoQuickCalc(binanceData) {
        const amtInput = document.getElementById('home-crypto-amt');
        const select = document.getElementById('home-crypto-select');
        if (!amtInput || !select) return;

        const updateCalc = () => {
            const sym = select.value + "USDT";
            const amt = parseFloat(amtInput.value) || 0;
            const rates = window.DolarVE.tasas;
            
            let priceUsd = 1; 
            if (select.value !== 'USDT') {
                const coin = binanceData.find(c => c.symbol === sym);
                priceUsd = coin ? parseFloat(coin.lastPrice) : 0;
                if (!coin && select.value === 'SHIB') {
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

    configurarModales() {
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
            
            overlay.onclick = (e) => {
                if (e.target === overlay) cerrar();
            };
        }
    }
};

window.openCryptoChart = (id, n, s, p, c, h, l) => Cripto.abrirDetalleCripto(id, n, s, p, c, h, l);
window.Cripto = Cripto;
