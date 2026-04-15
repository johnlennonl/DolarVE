/**
 * DolarVE - Dashboard de Conversión Live v4.2
 * Soporte Binance USDT, Bidireccional, Internacional y Temas Adaptativos.
 */

const Calculadora = {
    montoBase: 0,
    regionActiva: 've', 
    tasaSeleccionada: 'binance',
    modoInverso: false, // false: $/Moneda -> Bs/LATAM, true: Bs -> $

    init() {
        console.log('[DolarVE] Inicializando Dashboard de Calculadora v4.2...');
        this.vincularEventos();
        this.cargarEstado();
        this.actualizar();
    },

    vincularEventos() {
        const input = document.getElementById('calc-main-input');
        if (input) {
            input.addEventListener('input', (e) => {
                const rawValue = e.target.value.replace(',', '.');
                this.montoBase = parseFloat(rawValue) || 0;
                this.actualizar();
            });
        }

        document.getElementById('calc-swap-btn')?.addEventListener('click', () => this.toggleModo());

        const tabs = document.querySelectorAll('.region-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.cambiarRegion(tab.dataset.region);
            });
        });

        const cards = document.querySelectorAll('.rate-result-card');
        cards.forEach(card => {
            card.addEventListener('click', () => {
                this.seleccionarTasa(card.dataset.rate);
            });
        });

        document.getElementById('generate-receipt-btn')?.addEventListener('click', () => this.generarRecibo());
        document.getElementById('generate-charge-btn')?.addEventListener('click', () => {
            if (this.regionActiva === 've') {
                this.mostrarSelectorCuenta((cuenta) => this.generarSolicitudCobro(cuenta));
            }
        });

        document.getElementById('close-account-picker')?.addEventListener('click', () => this.ocultarSelectorCuenta());
        document.getElementById('account-picker-overlay')?.addEventListener('click', (e) => {
            if (e.target.id === 'account-picker-overlay') this.ocultarSelectorCuenta();
        });
    },

    toggleModo() {
        this.modoInverso = !this.modoInverso;
        const label = document.getElementById('calc-input-label');
        if (label) {
            label.innerText = this.modoInverso ? 'Monto en Bolívares (Bs.)' : 'Monto en Dólares ($)';
        }
        if (window.navigator.vibrate) window.navigator.vibrate(20);
        this.actualizar();
    },

    cargarEstado() {
        this.regionActiva = localStorage.getItem('dolarve_calc_region') || 've';
        const lastMonto = localStorage.getItem('dolarve_calc_monto');
        if (lastMonto) {
            this.montoBase = parseFloat(lastMonto);
            const input = document.getElementById('calc-main-input');
            if (input) input.value = this.montoBase;
        }
        this.cambiarRegion(this.regionActiva, false);
    },

    cambiarRegion(region, animar = true) {
        this.regionActiva = region;
        localStorage.setItem('dolarve_calc_region', region);

        const tabs = document.querySelectorAll('.region-tab');
        const indicator = document.getElementById('region-indicator');
        
        tabs.forEach(t => {
            t.classList.toggle('active', t.dataset.region === region);
            if (t.dataset.region === region && indicator) {
                const index = region === 've' ? 0 : 1;
                indicator.style.transform = `translateX(${index * 100}%)`;
            }
        });

        document.getElementById('calc-results-ve').classList.toggle('active', region === 've');
        document.getElementById('calc-results-int').classList.toggle('active', region === 'int');

        // REQUERIMIENTO: Ocultar botón Cobrar en Internacional
        const chargeBtn = document.getElementById('generate-charge-btn');
        if (chargeBtn) {
            chargeBtn.style.display = region === 'int' ? 'none' : 'flex';
        }

        if (region === 've') this.tasaSeleccionada = 'binance';
        else this.tasaSeleccionada = 'cop';
        
        this.actualizar();
    },

    seleccionarTasa(tasa) {
        this.tasaSeleccionada = tasa;
        this.actualizar();
        if (window.navigator.vibrate) window.navigator.vibrate(10);
    },

    actualizar() {
        const tasas = window.DolarVE.tasas;
        const monto = this.montoBase;
        localStorage.setItem('dolarve_calc_monto', monto);

        const calcular = (valorTasa) => {
            if (valorTasa <= 0) return 0;
            return this.modoInverso ? (monto / valorTasa) : (monto * valorTasa);
        };

        const formato = (val, locale = 'es-VE', digits = 2, suffix = '') => {
            return `${val.toLocaleString(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits })} ${suffix}`;
        };

        const suffixVE = this.modoInverso ? '$' : 'Bs';

        if (this.regionActiva === 've') {
            document.getElementById('res-bcv').innerText = formato(calcular(tasas.usd), 'es-VE', 2, suffixVE);
            document.getElementById('res-paralelo').innerText = formato(calcular(tasas.binance), 'es-VE', 2, suffixVE);
            document.getElementById('res-eur').innerText = formato(calcular(tasas.eur), 'es-VE', 2, suffixVE);
        } 
        else {
            document.getElementById('res-cop').innerText = formato(monto * (tasas.cop || 0), 'es-CO', 0, 'COP');
            document.getElementById('res-ars').innerText = formato(monto * (tasas.ars || 0), 'es-AR', 0, 'ARS');
            document.getElementById('res-brl').innerText = formato(monto * (tasas.brl || 0), 'pt-BR', 2, 'BRL');
            document.getElementById('res-clp').innerText = formato(monto * (tasas.clp || 0), 'es-CL', 0, 'CLP');
        }

        document.querySelectorAll('.rate-result-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.rate === this.tasaSeleccionada);
        });
    },

    async generarRecibo() {
        if (this.montoBase <= 0) {
            Interfaz.mostrarNotificacion('⚠️ Ingresa un monto primero');
            return;
        }

        const tasas = window.DolarVE.tasas;
        let nombreTasa = 'Tasa';
        let tasaValor = 0;
        let locale = 'es-VE';

        switch(this.tasaSeleccionada) {
            case 'bcv': nombreTasa = 'BCV Oficial'; tasaValor = tasas.usd; break;
            case 'binance': nombreTasa = 'Binance P2P'; tasaValor = tasas.binance; break;
            case 'eur': nombreTasa = 'Euro Oficial'; tasaValor = tasas.eur; break;
            case 'cop': nombreTasa = 'Colombia 🇨🇴'; tasaValor = tasas.cop; locale = 'es-CO'; break;
            case 'ars': nombreTasa = 'Argentina 🇦🇷'; tasaValor = tasas.ars; locale = 'es-AR'; break;
            case 'brl': nombreTasa = 'Brasil 🇧🇷'; tasaValor = tasas.brl; locale = 'pt-BR'; break;
            case 'clp': nombreTasa = 'Chile 🇨🇱'; tasaValor = tasas.clp; locale = 'es-CL'; break;
        }

        const resultado = this.modoInverso ? (this.montoBase / tasaValor) : (this.montoBase * tasaValor);
        const tickerDesde = this.modoInverso ? 'Bs.' : '$';
        const tickerHacia = this.modoInverso ? '$' : (this.regionActiva === 've' ? 'Bs.' : this.tasaSeleccionada.toUpperCase());

        // Llenar plantilla
        document.getElementById('rec-from').innerText = `${this.montoBase.toLocaleString(this.modoInverso ? 'es-VE' : 'en-US')} ${tickerDesde}`;
        document.getElementById('rec-to').innerText = `${resultado.toLocaleString(locale, { maximumFractionDigits: 2 })} ${tickerHacia}`;
        document.getElementById('rec-rate-name').innerText = nombreTasa;
        document.getElementById('rec-rate-val').innerText = `${tasaValor.toLocaleString(locale)} ${this.regionActiva === 've' ? 'Bs' : ''}`;
        document.getElementById('rec-date').innerText = new Date().toLocaleString('es-VE');

        Interfaz.mostrarNotificacion("Generando recibo... 📸");

        // REQUERIMIENTO: Captura adaptativa al tema
        setTimeout(async () => {
            const plantilla = document.getElementById('receipt-template');
            if (!plantilla) return;
            
            // FORZAR SIEMPRE OSCURO PARA CAPTURAS (Petición del usuario)
            plantilla.className = `receipt-card dark`;

            try {
                const canvas = await html2canvas(plantilla, { 
                    backgroundColor: '#0d0d0d', 
                    scale: 3, 
                    width: 350,
                    logging: false,
                    useCORS: true
                });
                const imgData = canvas.toDataURL('image/png');
                window.DolarVE.ultimoRecibo = imgData;
                const overlay = document.getElementById('receipt-modal-overlay');
                const imgEl = document.getElementById('receipt-preview-img');
                if (overlay && imgEl) { imgEl.src = imgData; overlay.style.display = 'flex'; overlay.offsetHeight; overlay.style.opacity = '1'; }
            } catch (e) { console.error(e); }
        }, 100);
    },

    async generarSolicitudCobro(cuenta) {
        if (this.montoBase <= 0) return;
        const tasas = window.DolarVE.tasas;
        let tasaValor = 0;
        let nombreTasa = '';
        if (this.tasaSeleccionada === 'bcv') { tasaValor = tasas.usd; nombreTasa = 'Oficial BCV'; }
        else if (this.tasaSeleccionada === 'eur') { tasaValor = tasas.eur; nombreTasa = 'Euro Oficial'; }
        else { tasaValor = tasas.binance; nombreTasa = 'Binance P2P'; }

        const montoBs = this.modoInverso ? this.montoBase : (this.montoBase * tasaValor);

        document.getElementById('charge-amount-val').innerText = montoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 });
        document.getElementById('charge-rate-val').innerText = nombreTasa;
        document.getElementById('charge-bank-val').innerText = cuenta.banco_nombre;
        document.getElementById('charge-phone-val').innerText = `${cuenta.prefijo_tel}-${cuenta.numero_tel}`;
        document.getElementById('charge-id-val').innerText = `${cuenta.tipo_documento}${cuenta.numero_documento}`;
        document.getElementById('charge-date-val').innerText = `Fecha: ${new Date().toLocaleDateString('es-VE')}`;

        Interfaz.mostrarNotificacion('Generando Solicitud... 💸');

        setTimeout(async () => {
            const template = document.getElementById('charge-template');
            if (!template) return;
            template.className = `charge-card dark`;

            try {
                const canvas = await html2canvas(template, { 
                    backgroundColor: '#0d0d0d', 
                    scale: 3, 
                    width: 350 
                });
                const imgData = canvas.toDataURL('image/png');
                window.DolarVE.ultimoRecibo = imgData;
                const overlay = document.getElementById('receipt-modal-overlay');
                const imgEl = document.getElementById('receipt-preview-img');
                if (overlay && imgEl) { imgEl.src = imgData; overlay.style.display = 'flex'; overlay.offsetHeight; overlay.style.opacity = '1'; }
            } catch (e) { console.error(e); }
        }, 100);
    },

    mostrarSelectorCuenta(callback) {
        const overlay = document.getElementById('account-picker-overlay');
        const listado = document.getElementById('account-picker-list');
        const sheet = document.getElementById('account-picker-sheet');
        if (!overlay || !listado) return;
        const cuentas = window.DolarVE.cuentas || [];
        if (cuentas.length === 0) { Interfaz.mostrarNotificacion('⚠️ Agrega una cuenta en Ajustes'); return; }
        
        listado.innerHTML = cuentas.map((acc, i) => {
            const bancoStr = acc.banco_nombre || acc.banco || "";
            const logoUrl = window.Cuentas ? window.Cuentas.getBankIcon(bancoStr) : null;
            const logoHtml = logoUrl ? `<img src="${logoUrl}" class="picker-bank-img">` : `<i class="ph-duotone ph-bank"></i>`;
            return `
                <button data-idx="${i}" class="picker-account-btn">
                    <div class="picker-bank-logo">${logoHtml}</div>
                    <div class="picker-account-content">
                        <div class="acc-label">${acc.etiqueta || 'Cuenta Personal'}</div>
                        <div class="acc-bank">${bancoStr}</div>
                    </div>
                </button>
            `;
        }).join('');

        listado.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => { this.ocultarSelectorCuenta(); callback(cuentas[parseInt(btn.dataset.idx)]); });
        });
        overlay.style.display = 'block'; overlay.offsetHeight; overlay.style.opacity = '1';
        if (sheet) sheet.style.transform = 'translateX(-50%) translateY(0)';
    },

    ocultarSelectorCuenta() {
        const overlay = document.getElementById('account-picker-overlay');
        const sheet = document.getElementById('account-picker-sheet');
        if (overlay) overlay.style.opacity = '0';
        if (sheet) sheet.style.transform = 'translateX(-50%) translateY(100%)';
        setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 300);
    },

    actualizarPantalla() { this.actualizar(); },

    async generarImagenCompartir() {
        if (!window.DolarVE.tasas) return;
        const { usd, binance, eur } = window.DolarVE.tasas;

        // Poblar template
        document.getElementById('cap-bcv-val').innerText = `${usd.toFixed(2)} Bs`;
        document.getElementById('cap-binance-val').innerText = `${binance.toFixed(2)} Bs`;
        document.getElementById('cap-euro-val').innerText = `${eur.toFixed(2)} Bs`;
        document.getElementById('cap-date').innerText = `Actualizado: ${new Date().toLocaleDateString('es-VE')} ${new Date().toLocaleTimeString('es-VE', {hour: '2-digit', minute:'2-digit'})}`;

        Interfaz.mostrarNotificacion('Preparando Resumen... 📊');

        setTimeout(async () => {
            const template = document.getElementById('rates-capture-template');
            if (!template) return;
            template.className = `receipt-card dark`;

            try {
                const canvas = await html2canvas(template, { 
                    backgroundColor: '#0d0d0d', 
                    scale: 3, 
                    width: 350,
                    windowWidth: 350
                });
                const imgData = canvas.toDataURL('image/png');
                window.DolarVE.ultimoRecibo = imgData;
                
                const overlay = document.getElementById('receipt-modal-overlay');
                const imgEl = document.getElementById('receipt-preview-img');
                if (overlay && imgEl) {
                    imgEl.src = imgData;
                    overlay.style.display = 'flex';
                    overlay.offsetHeight;
                    overlay.style.opacity = '1';
                }
            } catch (e) {
                console.error('[DolarVE] Error capturando diarias:', e);
            }
        }, 100);
    }
};

document.addEventListener('DOMContentLoaded', () => Calculadora.init());
window.Calculadora = Calculadora;
