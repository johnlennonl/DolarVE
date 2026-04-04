// ==========================================
// Módulo de Calculadora y Recibos - DolarVE
// Aquí es donde sucede la magia de las cuentas.
// Convertimos bolívares a dólares (y viceversa) y generamos recibos.
// ==========================================

const Calculadora = {
    // Función estrella: Actualiza la pantalla de la calculadora
    actualizarPantalla() {
        const config = window.DolarVE.config;
        const tasas = window.DolarVE.tasas;
        
        // 1. EVALUACIÓN ARITMÉTICA SEGURA
        const montoLimpio = this.evaluarExpresion(config.calc);
        
        let tasaActiva = 0;
        let nombreMoneda = '';

        if (config.base === 'bcv') { tasaActiva = tasas.usd; nombreMoneda = 'USD (BCV)'; }
        if (config.base === 'paralelo') { tasaActiva = tasas.paralelo; nombreMoneda = 'USD (Paralelo)'; }
        if (config.base === 'eur') { tasaActiva = tasas.eur; nombreMoneda = 'EUR'; }
        if (config.base === 'cop') { tasaActiva = tasas.cop || 3900; nombreMoneda = 'PESO COP'; }

        const fromValue = document.getElementById('calc-from-value');
        const toValue = document.getElementById('calc-to-value');
        const fromLabel = document.getElementById('calc-from-label');
        const toLabel = document.getElementById('calc-to-label');

        if (!fromValue || !toValue) return;

        // Mostramos lo que el usuario escribe (La expresión o el número)
        fromValue.innerText = config.calc;

        // Calculamos el resultado usando el monto ya EVALUADO
        let resultado = config.direccion ? (montoLimpio * tasaActiva) : (montoLimpio / tasaActiva);
        
        toValue.innerText = resultado.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        // Ajustamos las etiquetas según la moneda
        if (config.base === 'cop') {
            if (fromLabel) fromLabel.innerText = config.direccion ? "MONTO USD" : "MONTO COP";
            if (toLabel) toLabel.innerText = config.direccion ? "RESULTADO COP" : "RESULTADO USD";
            const chargeBtn = document.getElementById('generate-charge-btn');
            if (chargeBtn) chargeBtn.style.display = 'none';
        } else {
            const labelMoneda = config.base === 'eur' ? 'EUR' : 'USD';
            if (fromLabel) fromLabel.innerText = config.direccion ? `MONTO ${labelMoneda}` : "MONTO VES";
            if (toLabel) toLabel.innerText = config.direccion ? "RESULTADO VES" : `RESULTADO ${labelMoneda}`;
            const chargeBtn = document.getElementById('generate-charge-btn');
            if (chargeBtn) chargeBtn.style.display = 'flex';
        }

        // --- MANEJO DEL INDICADOR DESLIZANTE ---
        const chips = document.querySelectorAll('.rate-chip');
        chips.forEach(c => c.classList.remove('active'));
        
        const chipActivo = document.querySelector(`.rate-chip[data-rate="${config.base}"]`);
        const indicador = document.getElementById('rate-indicator');
        
        if (chipActivo && indicador) {
            chipActivo.classList.add('active');
            // Calculamos posición
            const rect = chipActivo.getBoundingClientRect();
            const parentRect = chipActivo.parentElement.getBoundingClientRect();
            indicador.style.width = `${rect.width - 10}px`;
            indicador.style.left = `${rect.left - parentRect.left}px`;
        }

        this.guardarEstado();
    },

    // Evaluador aritmético simple y seguro (sin usar eval)
    evaluarExpresion(expr) {
        try {
            // Limpiamos caracteres raros pero permitimos operadores básicos
            const f = new Function('return ' + expr.replace(/[^-()\d/*+.]/g, ''));
            const res = f();
            return isFinite(res) ? res : 0;
        } catch (e) {
            // Si el usuario está a media operación (ej: "10+"), devolvemos lo anterior parseable
            const match = expr.match(/^[\d.]+/);
            return match ? parseFloat(match[0]) : 0;
        }
    },

    // Guarda lo que el usuario tenía escrito en la calculadora
    guardarEstado() {
        const config = window.DolarVE.config;
        localStorage.setItem('dolarve_base', config.base);
        localStorage.setItem('dolarve_direction', config.direccion);
        localStorage.setItem('dolarve_calc', config.calc);
    },

    // Cambia entre BS -> USD o USD -> BS
    cambiarDireccion() {
        window.DolarVE.config.direccion = !window.DolarVE.config.direccion;
        this.actualizarPantalla();
        if (window.navigator.vibrate) window.navigator.vibrate(15);
    },

    // Cambia la moneda base (USD, EUR, COP)
    cambiarBase(moneda) {
        window.DolarVE.config.base = moneda;
        this.actualizarPantalla();
        if (window.navigator.vibrate) window.navigator.vibrate(15);
    },

    // Función para añadir números y operadores desde los botones
    presionarTecla(tecla) {
        let actual = window.DolarVE.config.calc;
        const operadores = ['+', '-', '*', '/'];

        if (tecla === 'C') {
            actual = "0";
        } else if (tecla === 'DEL') {
            actual = actual.length > 1 ? actual.slice(0, -1) : "0";
        } else if (operadores.includes(tecla)) {
            // No permitir dos operadores seguidos
            const ultimo = actual.slice(-1);
            if (operadores.includes(ultimo)) {
                actual = actual.slice(0, -1) + tecla;
            } else {
                actual += tecla;
            }
        } else if (tecla === '.') {
            // Lógica simple para el punto (solo uno por número)
            const partes = actual.split(/[\+\-\*\/]/);
            const ultimaParte = partes[partes.length - 1];
            if (!ultimaParte.includes('.')) actual += '.';
        } else {
            if (actual === "0") actual = tecla;
            else actual += tecla;
        }
        
        window.DolarVE.config.calc = actual;
        this.actualizarPantalla();
        if (window.navigator.vibrate) window.navigator.vibrate(10);
    },

    // Generar la imagen del recibo usando html2canvas
    async generarRecibo() {
        const config = window.DolarVE.config;
        const tasas = window.DolarVE.tasas;
        
        let nombreTasa = '';
        let tasaActiva = 0;
        if (config.base === 'bcv') { tasaActiva = tasas.usd; nombreTasa = 'BCV Oficial'; }
        if (config.base === 'paralelo') { tasaActiva = tasas.paralelo; nombreTasa = 'Paralelo'; }
        if (config.base === 'eur') { tasaActiva = tasas.eur; nombreTasa = 'Euro'; }

        const montoLimpio = this.evaluarExpresion(config.calc);
        const resultado = config.direccion ? (montoLimpio * tasaActiva) : (montoLimpio / tasaActiva);

        const tickerDesde = config.direccion ? (config.base === 'eur' ? '€' : '$') : 'Bs.';
        const tickerHacia = config.direccion ? 'Bs.' : (config.base === 'eur' ? '€' : '$');

        // Llenamos la plantilla invisible antes de la foto
        document.getElementById('rec-from').innerText = `${montoLimpio.toLocaleString('en-US')} ${tickerDesde}`;
        document.getElementById('rec-to').innerText = `${resultado.toLocaleString('es-VE')} ${tickerHacia}`;
        document.getElementById('rec-rate-name').innerText = nombreTasa;
        document.getElementById('rec-rate-val').innerText = `${tasaActiva.toLocaleString('es-VE')} Bs`;
        document.getElementById('rec-date').innerText = new Date().toLocaleString('es-VE');

        Interfaz.mostrarNotificacion("Generando recibo... 📸");

        setTimeout(async () => {
            const plantilla = document.getElementById('receipt-template');
            if (!plantilla) return;
            
            try {
                const canvas = await html2canvas(plantilla, {
                    backgroundColor: '#0d0d0d',
                    scale: 2,
                    width: 350
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
                console.error('[DolarVE] Error creando recibo:', e);
            }
        }, 100);
    },

    // Para cuando el usuario tiene varias cuentas de Pago Móvil
    mostrarSelectorCuenta(callback) {
        const overlay = document.getElementById('account-picker-overlay');
        const listado = document.getElementById('account-picker-list');
        const sheet = document.getElementById('account-picker-sheet');
        const btnCerrar = document.getElementById('close-account-picker');
        
        if (!overlay || !listado) return;

        // Listener para cerrar
        if (btnCerrar) {
            btnCerrar.onclick = () => this.ocultarSelectorCuenta();
        }

        // Necesitamos las cuentas que estén cargadas
        const cuentas = window.DolarVE.cuentas || [];
        
        if (cuentas.length === 0) {
            Interfaz.mostrarNotificacion('⚠️ Agrega una cuenta en Ajustes primero');
            return;
        }

        listado.innerHTML = cuentas.map((acc, i) => `
            <button data-idx="${i}" class="picker-account-btn">
                <div class="acc-label">${acc.etiqueta || 'Cuenta Personal'}</div>
                <div class="acc-bank">${acc.banco_nombre || acc.banco}</div>
            </button>
        `).join('');

        listado.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                this.ocultarSelectorCuenta();
                callback(cuentas[idx]);
            });
        });

        overlay.style.display = 'block';
        overlay.onclick = (e) => { if (e.target === overlay) this.ocultarSelectorCuenta(); };
        overlay.offsetHeight;
        overlay.style.opacity = '1';
        if (sheet) sheet.style.transform = 'translateX(-50%) translateY(0)';
    },

    ocultarSelectorCuenta() {
        const overlay = document.getElementById('account-picker-overlay');
        const sheet = document.getElementById('account-picker-sheet');
        if (overlay) overlay.style.opacity = '0';
        if (sheet) sheet.style.transform = 'translateX(-50%) translateY(100%)';
        setTimeout(() => { if (overlay) overlay.style.display = 'none'; }, 300);
    },

    // Generar imagen de la tasa diaria (Daily Rate Share)
    async generarImagenCompartir() {
        const tasas = window.DolarVE.tasas;
        
        const bcvVal = tasas.usd ? tasas.usd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---';
        const eurVal = tasas.eur ? `${tasas.eur.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs` : '--- Bs';

        document.getElementById('share-bcv-val').innerText = bcvVal;
        document.getElementById('share-eur-val').innerText = eurVal;
        document.getElementById('share-date-val').innerText = `Actualizado: Hoy, ${new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}`;

        Interfaz.mostrarNotificacion("Generando imagen para compartir... 🎥");

        setTimeout(async () => {
            const template = document.getElementById('daily-rate-template');
            if (!template) return;
            
            try {
                const canvas = await html2canvas(template, {
                    backgroundColor: '#0d0d0d',
                    scale: 2,
                    width: 350
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
                console.error('[DolarVE] Error compartiendo tasa:', e);
            }
        }, 100);
    },

    // Generar imagen de cobro con Pago Móvil
    async generarSolicitudCobro(cuenta) {
        const config = window.DolarVE.config;
        const tasas = window.DolarVE.tasas;
        
        let nombreTasa = '';
        let tasaActiva = 0;
        if (config.base === 'bcv') { tasaActiva = tasas.usd; nombreTasa = 'Oficial BCV'; }
        if (config.base === 'paralelo') { tasaActiva = tasas.paralelo; nombreTasa = 'Paralelo'; }
        if (config.base === 'eur') { tasaActiva = tasas.eur; nombreTasa = 'Euro Oficial'; }

        const montoLimpio = this.evaluarExpresion(config.calc);
        const montoBs = config.direccion ? (montoLimpio * tasaActiva) : montoLimpio;

        document.getElementById('charge-amount-val').innerText = montoBs.toLocaleString('es-VE', { minimumFractionDigits: 2 });
        document.getElementById('charge-rate-val').innerText = nombreTasa;
        document.getElementById('charge-bank-val').innerText = cuenta.banco_nombre;
        document.getElementById('charge-phone-val').innerText = `${cuenta.prefijo_tel}-${cuenta.numero_tel}`;
        document.getElementById('charge-id-val').innerText = `${cuenta.tipo_documento}${cuenta.numero_documento}`;
        document.getElementById('charge-date-val').innerText = `Fecha: ${new Date().toLocaleDateString('es-VE')}`;

        Interfaz.mostrarNotificacion('Generando Solicitud de Pago... 💸');

        setTimeout(async () => {
            const template = document.getElementById('charge-template');
            if (!template) return;
            
            try {
                const canvas = await html2canvas(template, {
                    backgroundColor: '#0d0d0d',
                    scale: 2,
                    width: 350
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
                console.error('[DolarVE] Error generando cobro:', e);
            }
        }, 100);
    }
};

window.Calculadora = Calculadora;
