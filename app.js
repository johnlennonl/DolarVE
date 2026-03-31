// DolarVE App Logic v4.0.0
document.addEventListener('DOMContentLoaded', () => {
    console.log('DolarVE APP LOADED');

    // 1. Local Storage for Theme
    const savedTheme = localStorage.getItem('dolarve_theme');
    const themeToggle = document.getElementById('theme-toggle');
    if (savedTheme === 'light') {
        document.body.classList.add('light-theme');
        if(themeToggle) themeToggle.classList.remove('on');
    }
    
    // Custom Toast Notification Logic
    window.showNotification = function(message) {
        const toast = document.getElementById('app-toast');
        const msgEl = document.getElementById('toast-message');
        if(!toast || !msgEl) return;
        msgEl.innerText = message;
        toast.classList.add('show');
        if(window.navigator.vibrate) window.navigator.vibrate(50);
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // Splash Screen Logic
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if(splash) splash.classList.add('hidden');
    }, 2000);

    const navItems = document.querySelectorAll('.nav-item');
    const screens = document.querySelectorAll('.screen');
    
    navItems.forEach((item, index) => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const doTransition = () => {
                navItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                screens.forEach(s => s.classList.remove('active'));
                screens[index].classList.add('active');
            };
            if (document.startViewTransition) {
                document.startViewTransition(doTransition);
            } else {
                doTransition();
            }
        });
    });

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            themeToggle.classList.toggle('on');
            document.body.classList.toggle('light-theme');
            localStorage.setItem('dolarve_theme', document.body.classList.contains('light-theme') ? 'light' : 'dark');
            if (window.navigator.vibrate) window.navigator.vibrate(10);
        });
    }

    // Calculator State (with LocalStorage)
    let currentUsdRate = 0;
    let currentEurRate = 0;
    let currentParaleloRate = 0;
    let baseCurrency = localStorage.getItem('dolarve_base') || 'bcv';
    let isForeignToVes = localStorage.getItem('dolarve_direction') ? localStorage.getItem('dolarve_direction') === 'true' : true;
    let calcInput = localStorage.getItem('dolarve_calc') || "1";

    const fromLabel = document.getElementById('calc-from-label');
    const toLabel = document.getElementById('calc-to-label');
    const fromValue = document.getElementById('calc-from-value');
    const toValue = document.getElementById('calc-to-value');

    function saveCalcState() {
        localStorage.setItem('dolarve_base', baseCurrency);
        localStorage.setItem('dolarve_direction', isForeignToVes);
        localStorage.setItem('dolarve_calc', calcInput);
    }

    function updateCalcDisplay() {
        let activeRate = 0;
        let rateName = '';
        if (baseCurrency === 'bcv') { activeRate = currentUsdRate; rateName = 'USD (BCV)'; }
        if (baseCurrency === 'paralelo') { activeRate = currentParaleloRate; rateName = 'USD (Paralelo)'; }
        if (baseCurrency === 'eur') { activeRate = currentEurRate; rateName = 'EUR'; }
        
        if(!fromValue || activeRate === 0) return;
        
        let displayStr = calcInput;
        // Format input purely for display
        if(displayStr.endsWith('.')) {
            fromValue.innerText = displayStr;
        } else {
            const parsedInput = parseFloat(calcInput) || 0;
            fromValue.innerText = parsedInput.toLocaleString('en-US', {maximumFractionDigits: 4});
        }
        
        const num = parseFloat(calcInput) || 0;
        const result = isForeignToVes ? (num * activeRate) : (num / activeRate);
        toValue.innerText = result.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        
        fromLabel.innerText = isForeignToVes ? `MONTO ${rateName.split(' ')[0]}` : "MONTO VES";
        toLabel.innerText = isForeignToVes ? "RESULTADO VES" : `RESULTADO ${rateName.split(' ')[0]}`;
        
        // Update chip UI
        document.querySelectorAll('.rate-chip').forEach(c => c.classList.remove('active'));
        const activeChip = document.querySelector(`.rate-chip[data-rate="${baseCurrency}"]`);
        if(activeChip) activeChip.classList.add('active');

        saveCalcState();
    }

    // Toggle Base Currency via Chips
    document.querySelectorAll('.rate-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            baseCurrency = e.target.getAttribute('data-rate');
            if(window.navigator.vibrate) window.navigator.vibrate(15);
            updateCalcDisplay();
        });
    });

    // Swap Btn
    const swapBtn = document.getElementById('swap-currency-btn');
    if(swapBtn) {
        swapBtn.addEventListener('click', () => {
            isForeignToVes = !isForeignToVes;
            updateCalcDisplay();
            if(window.navigator.vibrate) window.navigator.vibrate(15);
        });
    }

    // Chart.js Setup
    let bcvChartInstance = null;
    function initChart(currentPrice) {
        const ctx = document.getElementById('bcvChart');
        if(!ctx) return;
        
        const base = currentPrice;
        // Mocking a realistic 7-day ascending curve ending at current price
        const dataPoints = [base * 0.98, base * 0.985, base * 0.99, base * 0.992, base * 0.995, base * 0.998, base]; 
        
        if(bcvChartInstance) {
            bcvChartInstance.data.datasets[0].data = dataPoints;
            bcvChartInstance.update();
            return;
        }
        
        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 80);
        gradient.addColorStop(0, 'rgba(0, 208, 132, 0.4)');
        gradient.addColorStop(1, 'rgba(0, 208, 132, 0)');

        bcvChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['1', '2', '3', '4', '5', '6', '7'],
                datasets: [{
                    data: dataPoints,
                    borderColor: '#00D084',
                    borderWidth: 2,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: {
                    x: { display: false },
                    y: { display: false, min: base * 0.97, max: base * 1.01 }
                },
                layout: { padding: 0 }
            }
        });
    }

    async function fetchData() {
        if (!navigator.onLine) {
            window.showNotification('Modo Offline: Usando tasas recientes guardadas');
            const offlineData = JSON.parse(localStorage.getItem('dolarve_offline_data') || '{}');
            if(offlineData.usd) currentUsdRate = offlineData.usd;
            if(offlineData.eur) currentEurRate = offlineData.eur;
            if(offlineData.paralelo) currentParaleloRate = offlineData.paralelo;
            
            if(currentUsdRate) document.getElementById('usd-bcv-price').innerText = currentUsdRate.toFixed(2);
            if(currentParaleloRate) document.getElementById('paralelo-price').innerText = currentParaleloRate.toFixed(2);
            if(currentEurRate && document.getElementById('euro-top-price')) document.getElementById('euro-top-price').innerText = currentEurRate.toFixed(2);
            
            if(currentUsdRate > 0 && currentParaleloRate > 0) {
                const brecha = ((currentParaleloRate - currentUsdRate) / currentUsdRate) * 100;
                document.getElementById('brecha-value').innerText = `${brecha.toFixed(2)}%`;
                document.getElementById('brecha-bg').style.width = `${Math.min(brecha * 2, 100)}%`;
            }

            updateCalcDisplay();
            initChart(currentUsdRate);
            return;
        }

        try {
            const [usdRes, eurRes, parRes] = await Promise.all([
                fetch('https://ve.dolarapi.com/v1/dolares/oficial'),
                fetch('https://ve.dolarapi.com/v1/euros/oficial'),
                fetch('https://ve.dolarapi.com/v1/dolares/paralelo')
            ]);
            
            const usdData = await usdRes.json();
            const eurData = await eurRes.json();
            const parData = await parRes.json();

            currentUsdRate = usdData.promedio;
            document.getElementById('usd-bcv-price').innerText = currentUsdRate.toFixed(2);
            let updateTime = usdData.fechaActualizacion ? usdData.fechaActualizacion.split('T')[1].substring(0,5) : new Date().toLocaleTimeString();
            document.getElementById('last-update-usd').innerText = `Actualizado: ${updateTime}`;
            
            currentEurRate = eurData.promedio;
            if(document.getElementById('euro-top-price')) document.getElementById('euro-top-price').innerText = currentEurRate.toFixed(2);
            
            currentParaleloRate = parData.promedio;
            document.getElementById('paralelo-price').innerText = currentParaleloRate.toFixed(2);
            
            if(currentUsdRate > 0 && currentParaleloRate > 0) {
                const brecha = ((currentParaleloRate - currentUsdRate) / currentUsdRate) * 100;
                document.getElementById('brecha-value').innerText = `${brecha.toFixed(2)}%`;
                const trendIcon = brecha > 0 ? '<i class="fa-solid fa-arrow-trend-up" style="font-size: 14px; color: var(--accent-red);"></i>' : '';
                document.getElementById('brecha-value').innerHTML = `${brecha.toFixed(2)}% ${trendIcon}`;
                document.getElementById('brecha-bg').style.width = `${Math.min(brecha * 2, 100)}%`;
            }
            
            localStorage.setItem('dolarve_offline_data', JSON.stringify({
                usd: currentUsdRate,
                eur: currentEurRate,
                paralelo: currentParaleloRate
            }));

            updateCalcDisplay(); // Update calc with real initial rate
            initChart(currentUsdRate); // Mount Chart.js

            // Fetch Top 50 Cryptos
            const cryptoRes = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false');
            const cryptoData = await cryptoRes.json();
            
            const listContainer = document.getElementById('dynamic-crypto-list');
            if(listContainer) {
                listContainer.innerHTML = ''; // Clear loading spinner
                cryptoData.forEach(coin => {
                    const priceChg = coin.price_change_percentage_24h || 0;
                    const chgClass = priceChg >= 0 ? 'trend-up' : 'trend-down';
                    const listBg = priceChg >= 0 ? 'rgba(0, 208, 132, 0.05)' : 'rgba(255, 77, 77, 0.05)';
                    
                    const itemHtml = `
                        <div class="crypto-item" onclick="openCryptoChart('${coin.id}', '${coin.name}', '${coin.symbol.toUpperCase()}', ${coin.current_price}, ${priceChg})" style="position: relative; overflow: hidden; cursor: pointer;">
                            <div style="position: absolute; right: 0; top: 0; bottom: 0; width: 30%; background: linear-gradient(90deg, transparent, ${listBg}); pointer-events: none;"></div>
                            <div class="crypto-info" style="position: relative; z-index: 1;">
                                <div class="crypto-icon" style="background: transparent;">
                                    <img src="${coin.image}" alt="${coin.name}" style="width: 100%; height: 100%; border-radius: 50%;">
                                </div>
                                <div class="crypto-name">
                                    <div>${coin.name}</div>
                                    <div>${coin.symbol.toUpperCase()}</div>
                                </div>
                            </div>
                            <div class="crypto-price" style="position: relative; z-index: 1;">
                                <div>$${coin.current_price.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 6})}</div>
                                <div class="${chgClass}">${priceChg.toFixed(2)}%</div>
                            </div>
                        </div>
                    `;
                    listContainer.insertAdjacentHTML('beforeend', itemHtml);
                });
            }

            const fngRes = await fetch('https://api.alternative.me/fng/');
            const fngData = await fngRes.json();
            document.getElementById('fear-greed-value').innerText = `${fngData.data[0].value} / 100`;

            const globalRes = await fetch('https://api.coingecko.com/api/v3/global');
            const globalData = await globalRes.json();
            document.getElementById('btc-dominance').innerText = `${globalData.data.market_cap_percentage.btc.toFixed(1)}%`;

        } catch (e) {
            console.error('Fetch error:', e);
            window.showNotification('Error al cargar datos del mercado');
        }
    }

    fetchData();
    // Crypto Search Logic
    const searchInput = document.getElementById('crypto-search');
    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const items = document.querySelectorAll('.crypto-item');
            items.forEach(item => {
                const text = item.innerText.toLowerCase();
                item.style.display = text.includes(term) ? 'flex' : 'none';
            });
        });
    }

    setInterval(fetchData, 300000);

    // Crypto Modal Logic
    let detailChartInstance = null;
    window.openCryptoChart = async function(id, name, symbol, price, change) {
        if(window.navigator.vibrate) window.navigator.vibrate(10);
        
        const overlay = document.getElementById('crypto-modal-overlay');
        const modal = document.getElementById('crypto-modal');
        const titleEl = document.getElementById('crypto-modal-title');
        const priceEl = document.getElementById('crypto-modal-price');
        
        if(overlay && modal && titleEl && priceEl) {
            overlay.style.display = 'flex';
            setTimeout(() => {
                overlay.style.opacity = '1';
                modal.style.transform = 'translateY(0)';
            }, 10);
            
            titleEl.innerText = `${name} (${symbol})`;
            priceEl.innerText = `$${price.toLocaleString('en-US', {maximumFractionDigits: 6})}`;
            priceEl.style.color = change >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
            
            const ctx = document.getElementById('cryptoDetailCanvas');
            if(!ctx) return;
            
            // Show loading state on canvas
            if(detailChartInstance) { detailChartInstance.destroy(); }
            
            try {
                const res = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=1`);
                const data = await res.json();
                
                const prices = data.prices.map(p => p[1]);
                const labels = data.prices.map((p, i) => i);
                
                const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
                const isUp = change >= 0;
                gradient.addColorStop(0, isUp ? 'rgba(0, 208, 132, 0.4)' : 'rgba(255, 77, 77, 0.4)');
                gradient.addColorStop(1, isUp ? 'rgba(0, 208, 132, 0)' : 'rgba(255, 77, 77, 0)');

                detailChartInstance = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            data: prices,
                            borderColor: isUp ? '#00D084' : '#FF4D4D',
                            borderWidth: 2,
                            backgroundColor: gradient,
                            fill: true,
                            tension: 0.1,
                            pointRadius: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false }, tooltip: { enabled: false } },
                        scales: {
                            x: { display: false },
                            y: { display: false }
                        },
                        layout: { padding: 0 }
                    }
                });
            } catch (e) {
                console.error('Error fetching crypto chart:', e);
            }
        }
    };
    
    const closeCryptoModal = document.getElementById('close-crypto-modal');
    if(closeCryptoModal) {
        closeCryptoModal.addEventListener('click', () => {
            if(window.navigator.vibrate) window.navigator.vibrate(10);
            const overlay = document.getElementById('crypto-modal-overlay');
            const modal = document.getElementById('crypto-modal');
            overlay.style.opacity = '0';
            modal.style.transform = 'translateY(100%)';
            setTimeout(() => {
                overlay.style.display = 'none';
                if(detailChartInstance) { detailChartInstance.destroy(); detailChartInstance = null; }
            }, 300);
        });
    }

    document.querySelectorAll('button, .nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            if (window.navigator.vibrate) window.navigator.vibrate(10);
        });
    });

    // Special click logic for calc buttons (Numpad only)
    document.querySelectorAll('.calc-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (window.navigator.vibrate) window.navigator.vibrate(15);
            
            const val = e.target.innerText;
            if (val.trim() === 'C') {
                calcInput = "0";
            } else if (val.includes('GENERAR RECIBO')) {
                if(calcInput === "0" || calcInput === "") return;
                
                let rateName = '';
                let activeRate = 0;
                if (baseCurrency === 'bcv') { activeRate = currentUsdRate; rateName = 'BCV Oficial'; }
                if (baseCurrency === 'paralelo') { activeRate = currentParaleloRate; rateName = 'Paralelo'; }
                if (baseCurrency === 'eur') { activeRate = currentEurRate; rateName = 'Euro'; }
                
                const num = parseFloat(calcInput) || 0;
                const result = isForeignToVes ? (num * activeRate) : (num / activeRate);
                
                const fromTicker = isForeignToVes ? (baseCurrency==='eur'?'€':'$') : 'Bs.';
                const toTicker = isForeignToVes ? 'Bs.' : (baseCurrency==='eur'?'€':'$');
                
                document.getElementById('rec-from').innerText = `${num.toLocaleString('en-US', {maximumFractionDigits: 4})} ${fromTicker}`;
                document.getElementById('rec-to').innerText = `${result.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})} ${toTicker}`;
                document.getElementById('rec-rate-name').innerText = rateName;
                document.getElementById('rec-rate-val').innerText = `${activeRate.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})} Bs`;
                document.getElementById('rec-date').innerText = new Date().toLocaleString('es-VE');
                
                window.showNotification("Generando recibo...");
                
                // Allow rendering cycle
                setTimeout(async () => {
                    const rcptDiv = document.getElementById('receipt-template');
                    try {
                        const canvas = await html2canvas(rcptDiv, { 
                            backgroundColor: 'transparent',
                            scale: 3,
                            logging: false,
                            windowWidth: 350,
                            scrollX: 0,
                            scrollY: 0,
                            x: 0,
                            y: 0 
                        });
                        
                        const imgData = canvas.toDataURL('image/png');
                        window.btnDataToShare = imgData;
                        
                        const overlay = document.getElementById('receipt-modal-overlay');
                        const imgEl = document.getElementById('receipt-preview-img');
                        
                        if(overlay && imgEl) {
                            imgEl.src = imgData;
                            overlay.style.display = 'flex';
                            setTimeout(() => {
                                overlay.style.opacity = '1';
                            }, 10);
                        }
                    } catch(e) { 
                        console.error(e); 
                        window.showNotification('Falló generación. Intente refrescar.');
                    }
                }, 100);
                return;
            } else {
                if(calcInput === "0" && val !== '.') calcInput = val;
                else if (val === '.' && calcInput.includes('.')) return; // Prevent double dots
                else calcInput += val;
                
                // Max length prevention
                if(calcInput.length > 12) {
                    calcInput = calcInput.substring(0, 12);
                    window.showNotification('Límite de dígitos alcanzado');
                }
            }
            updateCalcDisplay();
        });
    });

    // Receipt Modal Button Handlers
    window.btnDataToShare = null;
    const closeReceiptBtn = document.getElementById('close-receipt-modal');
    if(closeReceiptBtn) {
        closeReceiptBtn.addEventListener('click', () => {
            if(window.navigator.vibrate) window.navigator.vibrate(10);
            const overlay = document.getElementById('receipt-modal-overlay');
            overlay.style.opacity = '0';
            setTimeout(() => overlay.style.display = 'none', 300);
        });
    }

    const shareReceiptBtn = document.getElementById('share-receipt-btn');
    if(shareReceiptBtn) {
        shareReceiptBtn.addEventListener('click', async () => {
            if(window.navigator.vibrate) window.navigator.vibrate(10);
            if(!window.btnDataToShare) return;

            if (navigator.share) {
                try {
                    const res = await fetch(window.btnDataToShare);
                    const blob = await res.blob();
                    const file = new File([blob], `Recibo_DolarVE_${Date.now()}.png`, { type: 'image/png' });
                    
                    await navigator.share({
                        title: 'Recibo de Conversión DolarVE',
                        files: [file]
                    });
                } catch (err) {
                    console.error('Error sharing receipt:', err);
                }
            } else {
                const link = document.createElement('a');
                link.download = `Recibo_DolarVE_${Date.now()}.png`;
                link.href = window.btnDataToShare;
                link.click();
            }
        });
    }
});

