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
        
        if(!fromValue) return;
        
        let displayStr = calcInput;
        // Format input purely for display
        if(displayStr.endsWith('.')) {
            fromValue.innerText = displayStr;
        } else {
            const parsedInput = parseFloat(calcInput) || 0;
            fromValue.innerText = parsedInput.toLocaleString('en-US', {maximumFractionDigits: 4});
        }
        
        if(activeRate === 0) {
            toValue.innerText = "0.00";
            return;
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
            
            if(window.updateQuickReference) window.updateQuickReference();

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
            let updateTime = new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
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
            
            if(window.updateQuickReference) window.updateQuickReference();
            
            localStorage.setItem('dolarve_offline_data', JSON.stringify({
                usd: currentUsdRate,
                eur: currentEurRate,
                paralelo: currentParaleloRate
            }));
            
            checkAndSendSystemNotification(currentUsdRate, currentEurRate);

            updateCalcDisplay(); // Update calc with real initial rate
            initChart(currentUsdRate); // Mount Chart.js
        } catch (e) {
            console.error('Fiat fetch error:', e);
            window.showNotification('Error al cargar datos del BCV');
        }

        try {
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
            console.warn('Crypto fetch error:', e);
            const listContainer = document.getElementById('dynamic-crypto-list');
            if(listContainer) {
                listContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted);"><i class="fa-solid fa-server" style="margin-bottom:10px; font-size: 20px;"></i><br>Servidor Cripto ocupado.<br>Intenta refrescar en un rato.</div>';
            }
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
            const errorOverlay = document.getElementById('crypto-chart-error');
            if(!ctx) return;
            
            // Show loading state
            if(detailChartInstance) { detailChartInstance.destroy(); }
            if(errorOverlay) errorOverlay.style.display = 'none';
            ctx.style.display = 'block';
            
            try {
                const res = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=1`);
                const data = await res.json();
                
                if (!res.ok || !data.prices || data.prices.length === 0) {
                    throw new Error("No chart data available");
                }
                
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
                ctx.style.display = 'none';
                if(errorOverlay) errorOverlay.style.display = 'flex';
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
            
            const targetBtn = e.target.closest('.calc-btn');
            if(!targetBtn) return;
            
            const val = targetBtn.innerText.trim();
            if (val === 'C') {
                calcInput = "0";
            } else if (val.includes('RECIBO')) {
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
                    console.log('[DolarVE DEBUG] receipt-template found:', !!rcptDiv);
                    if(!rcptDiv) { window.showNotification('Error: Plantilla recibo no encontrada'); return; }
                    try {
                        console.log('[DolarVE DEBUG] Starting receipt html2canvas...');
                        const canvas = await html2canvas(rcptDiv, { 
                            backgroundColor: '#0d0d0d',
                            scale: 2,
                            logging: true,
                            useCORS: true,
                            allowTaint: true,
                            width: 350,
                            height: rcptDiv.scrollHeight || 400,
                            scrollX: 0,
                            scrollY: 0,
                            x: 0,
                            y: 0,
                            removeContainer: true,
                            foreignObjectRendering: false
                        });
                        console.log('[DolarVE DEBUG] Receipt canvas DONE:', canvas.width, 'x', canvas.height);
                        
                        const imgData = canvas.toDataURL('image/png');
                        window.btnDataToShare = imgData;
                        
                        const overlay = document.getElementById('receipt-modal-overlay');
                        const imgEl = document.getElementById('receipt-preview-img');
                        
                        if(overlay && imgEl) {
                            imgEl.src = imgData;
                            overlay.style.display = 'flex';
                            overlay.offsetHeight; // force reflow
                            overlay.style.opacity = '1';
                        }
                    } catch(e) { 
                        console.error('[DolarVE DEBUG] Receipt ERROR:', e); 
                        window.showNotification('Error: ' + e.message);
                    }
                }, 100);
                return;
            } else if(val.includes('COBRAR')) {
                if(calcInput === "0" || calcInput === "") return;
                
                const pm = JSON.parse(localStorage.getItem('dolarve_pagomovil'));
                if(!pm || !pm.banco || !pm.idNum || !pm.telNum) {
                    window.showNotification('⚠️ Configura tus Datos de Cobro en Ajustes');
                    setTimeout(() => {
                        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
                        document.querySelectorAll('.nav-item')[3].classList.add('active');
                        document.getElementById('settings-screen').classList.add('active');
                    }, 1500);
                    return;
                }
                
                let rateName = '';
                let activeRate = 0;
                if (baseCurrency === 'bcv') { activeRate = currentUsdRate; rateName = 'Oficial BCV'; }
                if (baseCurrency === 'paralelo') { activeRate = currentParaleloRate; rateName = 'Dólar Paralelo'; }
                if (baseCurrency === 'eur') { activeRate = currentEurRate; rateName = 'Euro Oficial'; }
                
                const num = parseFloat(calcInput) || 0;
                if(num === 0 || activeRate === 0) return;
                
                const bsAmount = isForeignToVes ? (num * activeRate) : num;
                const formattedBs = bsAmount.toLocaleString('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                
                document.getElementById('charge-amount-val').innerText = formattedBs;
                document.getElementById('charge-rate-val').innerText = rateName;
                document.getElementById('charge-bank-val').innerText = pm.banco;
                document.getElementById('charge-phone-val').innerText = `${pm.telPrefix}-${pm.telNum}`;
                document.getElementById('charge-id-val').innerText = `${pm.idType}${pm.idNum}`;
                document.getElementById('charge-date-val').innerText = `Fecha: ${new Date().toLocaleDateString('es-VE')}`;
                
                window.showNotification('Generando Solicitud...');
                
                setTimeout(async () => {
                    const chargeDiv = document.getElementById('charge-template');
                    console.log('[DolarVE DEBUG] charge-template found:', !!chargeDiv);
                    if(!chargeDiv) { window.showNotification('Error: Plantilla cobro no encontrada'); return; }
                    try {
                        console.log('[DolarVE DEBUG] Starting charge html2canvas...');
                        const canvas = await html2canvas(chargeDiv, {
                            backgroundColor: '#0d0d0d',
                            scale: 2,
                            logging: true,
                            useCORS: true,
                            allowTaint: true,
                            width: 350,
                            height: chargeDiv.scrollHeight || 500,
                            scrollX: 0,
                            scrollY: 0,
                            x: 0,
                            y: 0,
                            removeContainer: true,
                            foreignObjectRendering: false
                        });
                        console.log('[DolarVE DEBUG] Charge canvas DONE:', canvas.width, 'x', canvas.height);
                        const imgData = canvas.toDataURL('image/png');
                        window.btnDataToShare = imgData;
                        
                        const overlay = document.getElementById('receipt-modal-overlay');
                        const imgEl = document.getElementById('receipt-preview-img');
                        if (overlay && imgEl) {
                            imgEl.src = imgData;
                            overlay.style.display = 'flex';
                            overlay.offsetHeight; // force reflow
                            overlay.style.opacity = '1';
                        }
                    } catch(e) { console.error('[DolarVE DEBUG] Charge ERROR:', e); window.showNotification('Error: ' + e.message); }
                }, 100);
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

    // --- SHARE DAILY RATE LOGIC ---
    const shareDailyBtn = document.getElementById('share-daily-rate-btn');
    if(shareDailyBtn) {
        shareDailyBtn.addEventListener('click', () => {
            if(window.navigator.vibrate) window.navigator.vibrate(15);
            
            // Populate template
            const bcvVal = currentUsdRate ? currentUsdRate.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2}) : '---';
            const eurVal = currentEurRate ? `${currentEurRate.toLocaleString('es-VE', {minimumFractionDigits:2, maximumFractionDigits:2})} Bs` : '--- Bs';
            
            document.getElementById('share-bcv-val').innerText = bcvVal;
            document.getElementById('share-eur-val').innerText = eurVal;
            document.getElementById('share-date-val').innerText = `Actualizado: Hoy, ${new Date().toLocaleTimeString('es-VE', {hour:'2-digit', minute:'2-digit'})}`;
            
            window.showNotification("Generando imagen para compartir...");
            
            setTimeout(async () => {
                const templateDiv = document.getElementById('daily-rate-template');
                console.log('[DolarVE DEBUG] daily-rate-template found:', !!templateDiv);
                if(!templateDiv) { window.showNotification('Error: Plantilla no encontrada'); return; }
                if(typeof html2canvas !== 'function') { window.showNotification('Error: Librería no cargada'); return; }
                try {
                    console.log('[DolarVE DEBUG] Starting html2canvas render...');
                    const canvas = await html2canvas(templateDiv, { 
                        backgroundColor: '#0d0d0d',
                        scale: 2, 
                        logging: false,
                        useCORS: true,
                        allowTaint: true,
                        width: 350,
                        height: templateDiv.scrollHeight || 400,
                        scrollX: 0,
                        scrollY: 0,
                        x: 0,
                        y: 0,
                        removeContainer: true,
                        foreignObjectRendering: false
                    });
                    console.log('[DolarVE DEBUG] html2canvas COMPLETED! Canvas:', canvas.width, 'x', canvas.height);
                    
                    const imgData = canvas.toDataURL('image/png');
                    window.btnDataToShare = imgData;
                    
                    // Show preview in modal
                    const overlay = document.getElementById('receipt-modal-overlay');
                    const imgEl = document.getElementById('receipt-preview-img');
                    if(overlay && imgEl) {
                        imgEl.src = imgData;
                        overlay.style.display = 'flex';
                        // Force reflow before opacity transition
                        overlay.offsetHeight;
                        overlay.style.opacity = '1';
                    }
                } catch(e) { 
                    console.error('[DolarVE DEBUG] html2canvas ERROR:', e); 
                    window.showNotification('Error: ' + e.message);
                }
            }, 100);
        });
    }

    // --- SYSTEM NOTIFICATIONS LOGIC (BCV & EURO ONLY) ---
    const toggleAnimationsBtn = document.getElementById('toggle-animations-btn');
    if(toggleAnimationsBtn) {
        toggleAnimationsBtn.addEventListener('click', () => {
            toggleAnimationsBtn.classList.toggle('on');
            if(window.navigator.vibrate) window.navigator.vibrate(10);
        });
    }

    const toggleNotifications = document.getElementById('toggle-notifications-btn');
    if (toggleNotifications) {
        // Sync Initial State
        const savedNotifs = localStorage.getItem('dolarve_notifs_enabled');
        if (savedNotifs === 'true' && Notification.permission === 'granted') {
            toggleNotifications.classList.add('on');
        } else {
            toggleNotifications.classList.remove('on');
        }

        toggleNotifications.addEventListener('click', async () => {
            const isTurningOn = !toggleNotifications.classList.contains('on');
            if(window.navigator.vibrate) window.navigator.vibrate(10);
            
            if (isTurningOn) {
                if (!('Notification' in window)) {
                    window.showNotification("Tu navegador no soporta Notificaciones.");
                    return;
                }
                const perm = await Notification.requestPermission();
                if (perm === 'granted') {
                    toggleNotifications.classList.add('on');
                    localStorage.setItem('dolarve_notifs_enabled', 'true');
                    window.showNotification("Notificaciones activadas con éxito");
                    checkAndSendSystemNotification(currentUsdRate, currentEurRate, true);
                } else {
                    window.showNotification("Permiso denegado por el dispositivo");
                }
            } else {
                toggleNotifications.classList.remove('on');
                localStorage.setItem('dolarve_notifs_enabled', 'false');
                window.showNotification("Notificaciones desactivadas");
            }
        });
    }

    window.checkAndSendSystemNotification = function(newBcv, newEur, isWelcome = false) {
        if (localStorage.getItem('dolarve_notifs_enabled') !== 'true' || Notification.permission !== 'granted') return;

        if (isWelcome && newBcv && newEur) {
            sendPush("DolarVE Alertas Activas", `BCV: ${newBcv.toLocaleString('es-VE')}Bs | Euro: ${newEur.toLocaleString('es-VE')}Bs.\nTe avisaré si cambian.`);
            localStorage.setItem('dolarve_last_bcv', newBcv.toString());
            localStorage.setItem('dolarve_last_eur', newEur.toString());
            return;
        }

        const lastBcv = parseFloat(localStorage.getItem('dolarve_last_bcv')) || 0;
        const lastEur = parseFloat(localStorage.getItem('dolarve_last_eur')) || 0;

        let changes = [];
        if (lastBcv !== 0 && newBcv !== lastBcv && newBcv !== 0) {
            changes.push(`BCV a ${newBcv.toLocaleString('es-VE')} Bs`);
        }
        if (lastEur !== 0 && newEur !== lastEur && newEur !== 0) {
            changes.push(`Euro a ${newEur.toLocaleString('es-VE')} Bs`);
        }

        if (changes.length > 0) {
            sendPush("¡DolarVE Cambio Oficial!", changes.join(" | "));
        }

        // Always Update Memory
        if (newBcv !== 0) localStorage.setItem('dolarve_last_bcv', newBcv.toString());
        if (newEur !== 0) localStorage.setItem('dolarve_last_eur', newEur.toString());
    }

    function sendPush(title, body) {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification(title, {
                    body: body,
                    icon: 'logo.png',
                    badge: 'logo.png',
                    vibrate: [200, 100, 200]
                });
            }).catch(err => {
                new Notification(title, { body, icon: 'logo.png' });
            });
        } else {
            new Notification(title, { body, icon: 'logo.png' });
        }
    }

    // --- TEST NOTIFICATIONS BUTTON ---
    const testNotifBtn = document.getElementById('test-notification-btn');
    if (testNotifBtn) {
        testNotifBtn.addEventListener('click', () => {
            if (Notification.permission !== 'granted') {
                window.showNotification("Debes Activar y Permitir las Notificaciones Arriba Primero ☝️");
                return;
            }
            if(window.navigator.vibrate) window.navigator.vibrate(20);
            
            testNotifBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Bloquea tu celular ahora... (20s)';
            testNotifBtn.style.color = "var(--text-muted)";
            testNotifBtn.style.borderColor = "var(--card-border)";
            
            setTimeout(() => {
                const bcv = currentUsdRate ? currentUsdRate.toLocaleString('es-VE') : '---';
                const eur = currentEurRate ? currentEurRate.toLocaleString('es-VE') : '---';
                sendPush("¡DolarVE Cambio Oficial!", `BCV a ${bcv} Bs | Euro a ${eur} Bs`);
                
                testNotifBtn.innerHTML = '<i class="fa-solid fa-check"></i> Prueba Enviada';
                testNotifBtn.style.color = "var(--accent-green)";
                testNotifBtn.style.borderColor = "var(--accent-green)";
                
                setTimeout(() => {
                    testNotifBtn.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> Emitir Señal de Prueba (20s)';
                }, 4000);
            }, 20000);
        });
    }

    // --- QUICK REFERENCE LOGIC ---
    let currentReferenceAmount = 100;
    
    window.updateQuickReference = function() {
        const bcvEl = document.getElementById('quick-ref-bcv');
        const eurEl = document.getElementById('quick-ref-eur');
        if(bcvEl && currentUsdRate) bcvEl.innerText = (currentUsdRate * currentReferenceAmount).toLocaleString('es-VE') + ' Bs';
        if(eurEl && currentEurRate) eurEl.innerText = (currentEurRate * currentReferenceAmount).toLocaleString('es-VE') + ' Bs';
    };

    document.querySelectorAll('.quick-amt-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            if(window.navigator.vibrate) window.navigator.vibrate(10);
            document.querySelectorAll('.quick-amt-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentReferenceAmount = parseInt(e.target.getAttribute('data-amt'));
            window.updateQuickReference();
        });
    });
    // --- PAGO MOVIL SETTINGS LOGIC ---
    const pmBanco = document.getElementById('pm-banco');
    const pmIdType = document.getElementById('pm-id-type');
    const pmIdNum = document.getElementById('pm-id-num');
    const pmTelPrefix = document.getElementById('pm-tel-prefix');
    const pmTelNum = document.getElementById('pm-tel-num');
    const savePmBtn = document.getElementById('save-pm-btn');

    // Load saved data
    const savedPm = JSON.parse(localStorage.getItem('dolarve_pagomovil')) || {};
    if(savedPm.banco && pmBanco) pmBanco.value = savedPm.banco;
    if(savedPm.idType && pmIdType) pmIdType.value = savedPm.idType;
    if(savedPm.idNum && pmIdNum) pmIdNum.value = savedPm.idNum;
    if(savedPm.telPrefix && pmTelPrefix) pmTelPrefix.value = savedPm.telPrefix;
    if(savedPm.telNum && pmTelNum) pmTelNum.value = savedPm.telNum;

    if(savePmBtn) {
        savePmBtn.addEventListener('click', () => {
            if(window.navigator.vibrate) window.navigator.vibrate(15);
            
            if(!pmBanco.value || !pmIdNum.value || !pmTelNum.value) {
                window.showNotification("Por favor, llena todos los campos");
                return;
            }

            const pmData = {
                banco: pmBanco.value,
                idType: pmIdType.value,
                idNum: pmIdNum.value,
                telPrefix: pmTelPrefix.value,
                telNum: pmTelNum.value
            };
            
            localStorage.setItem('dolarve_pagomovil', JSON.stringify(pmData));
            
            // Visual feedback
            const originalText = savePmBtn.innerHTML;
            savePmBtn.innerHTML = '<i class="fa-solid fa-check"></i> ¡Guardado Exitosamente!';
            savePmBtn.style.background = '#000';
            savePmBtn.style.color = '#00D084';
            savePmBtn.style.border = '1px solid #00D084';
            setTimeout(() => {
                savePmBtn.innerHTML = originalText;
                savePmBtn.style.background = 'linear-gradient(90deg, #00D084, #00a669)';
                savePmBtn.style.color = '#000';
                savePmBtn.style.border = 'none';
            }, 2500);
            
            window.showNotification("¡Datos de Pago Móvil guardados!");
        });
    }
});

