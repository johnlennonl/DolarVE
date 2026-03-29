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
            
            localStorage.setItem('dolarve_offline_data', JSON.stringify({
                usd: currentUsdRate,
                eur: currentEurRate,
                paralelo: currentParaleloRate
            }));

            updateCalcDisplay(); // Update calc with real initial rate
            initChart(currentUsdRate); // Mount Chart.js

            // Fetch Top 20 Cryptos
            const cryptoRes = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false');
            const cryptoData = await cryptoRes.json();
            
            const listContainer = document.getElementById('dynamic-crypto-list');
            if(listContainer) {
                listContainer.innerHTML = ''; // Clear loading spinner
                cryptoData.forEach(coin => {
                    const priceChg = coin.price_change_percentage_24h || 0;
                    const chgClass = priceChg >= 0 ? 'trend-up' : 'trend-down';
                    
                    const itemHtml = `
                        <div class="crypto-item">
                            <div class="crypto-info">
                                <div class="crypto-icon" style="background: transparent;">
                                    <img src="${coin.image}" alt="${coin.name}" style="width: 100%; height: 100%; border-radius: 50%;">
                                </div>
                                <div class="crypto-name">
                                    <div>${coin.name}</div>
                                    <div>${coin.symbol.toUpperCase()}</div>
                                </div>
                            </div>
                            <div class="crypto-price">
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
            if(val === 'C') {
                calcInput = "0";
            } else if (val === 'GENERAR RECIBO') {
                if(!window.html2canvas) {
                    window.showNotification("Cargando motor de recibos...");
                    return;
                }
                
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
                        const canvas = await html2canvas(rcptDiv, { backgroundColor: '#161B22', scale: 2 });
                        canvas.toBlob(blob => {
                            const file = new File([blob], 'recibo-dolarve.png', { type: 'image/png' });
                            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                                navigator.share({
                                    files: [file],
                                    title: 'Recibo DolarVE',
                                    text: 'Recibo generado al instante'
                                });
                            } else {
                                const a = document.createElement('a');
                                a.href = URL.createObjectURL(blob);
                                a.download = 'recibo-dolarve.png';
                                a.click();
                            }
                        }, 'image/png');
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
});

