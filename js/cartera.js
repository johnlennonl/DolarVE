/**
 * 📈 DolarVE Mi Cartera v7.0 (The Modular & Purist Form)
 * Módulo de gestión de patrimonio multi-perfil modularizado
 * Desarrollado por Antigravity para DolarVE
 */

const Cartera = {
    perfiles: [],
    perfilActivoId: null,
    operacionActual: null,
    monedaActiva: 'USD',
    tasaPreferenciaRef: 'BCV', // 'BCV' o 'PARALELO'
    apexChart: null,
    isLoaded: false,

    async inicializar() {
        console.log('[Cartera] Inicializando v7.0 Modular...');
        
        // 1. Cargar Estructura HTML si no está poblada
        const screen = document.getElementById('portfolio-screen');
        if (screen && screen.innerHTML.trim() === "") {
            await this.cargarEstructura();
        }

        // 2. Cargar Datos
        this.cargarDatosLocal();
        
        if (window.DolarVE.usuario) {
            await this.cargarDesdeSupabase();
        }

        if (this.perfiles.length === 0) {
            this.crearPerfil("Principal", "ph-fill ph-user", "#1e113a");
        }

        // Asegurar que haya un perfil activo
        if (!this.perfilActivoId && this.perfiles.length > 0) {
            this.perfilActivoId = this.perfiles[0].id;
        }

        this.vincularEventos();
        this.renderizar();
        this.isLoaded = true;
        
        // AutoAnimate para el historial
        const histList = document.getElementById('portfolio-history-list');
        if (histList && window.autoAnimate) window.autoAnimate(histList);
    },

    async cargarEstructura() {
        console.log('[Cartera] Cargando estructura modular cartera.html...');
        try {
            const response = await fetch('cartera.html');
            const html = await response.text();
            const container = document.getElementById('portfolio-screen');
            if (container) {
                container.innerHTML = html;
            }
        } catch (e) {
            console.error('[Cartera] Error cargando cartera.html:', e);
        }
    },

    mostrarLoader() {
        const loader = document.getElementById('cv-loader-overlay');
        if (loader) loader.classList.add('active');
    },

    ocultarLoader() {
        const loader = document.getElementById('cv-loader-overlay');
        if (loader) loader.classList.remove('active');
    },

    vincularEventos() {
        console.log('[Cartera] Vinculando eventos v7.0...');
        
        const btnSaveProfile = document.getElementById('save-p-profile-btn');
        if (btnSaveProfile) btnSaveProfile.onclick = () => this.confirmarNuevoPerfil();

        const btnSaveOp = document.getElementById('save-p-op-btn');
        if (btnSaveOp) btnSaveOp.onclick = () => this.confirmarOperacion();

        const selectMoneda = document.getElementById('p-op-currency');
        if (selectMoneda) selectMoneda.onchange = () => this.checkConversionBox();

        const inputMonto = document.getElementById('p-op-amount');
        if (inputMonto) inputMonto.oninput = () => this.checkConversionBox();

        const btnHist = document.getElementById('cv-btn-ver-historial');
        if (btnHist) btnHist.onclick = () => this.abrirModalHistorial();

        this.vincularIconos();
        this.vincularColores();
    },

    vincularColores() {
        document.querySelectorAll('.color-chip').forEach(chip => {
            chip.onclick = () => {
                document.querySelectorAll('.color-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            };
        });
    },

    vincularIconos() {
        document.querySelectorAll('.icon-chip').forEach(chip => {
            chip.onclick = () => {
                document.querySelectorAll('.icon-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            };
        });
    },

    guardarDatos() {
        const data = {
            perfiles: this.perfiles,
            perfilActivoId: this.perfilActivoId,
            monedaActiva: this.monedaActiva
        };
        localStorage.setItem('dolarve_cartera_v4', JSON.stringify(data));
        if (window.DolarVE.usuario) this.sincronizarSupabase();
    },

    async sincronizarSupabase() {
        if (!window.DolarVE.usuario) return;
        const user = window.DolarVE.usuario;
        try {
            await window.DolarVE.supabase
                .from('user_profiles_v2')
                .upsert({ 
                    id: user.id, 
                    portfolio_data: {
                        perfiles: this.perfiles,
                        perfilActivoId: this.perfilActivoId,
                        monedaActiva: this.monedaActiva
                    },
                    updated_at: new Date()
                });
        } catch (e) {
            console.error('[Cartera] Error Supabase:', e);
        }
    },

    async cargarDesdeSupabase() {
        if (!window.DolarVE.usuario) return;
        const user = window.DolarVE.usuario;
        try {
            const { data, error } = await window.DolarVE.supabase
                .from('user_profiles_v2')
                .select('portfolio_data')
                .eq('id', user.id)
                .single();

            if (data && data.portfolio_data) {
                const pd = data.portfolio_data;
                this.perfiles = pd.perfiles || this.perfiles;
                this.perfilActivoId = pd.perfilActivoId || this.perfilActivoId;
                this.monedaActiva = pd.monedaActiva || this.monedaActiva;
                this.renderizar();
            }
        } catch (e) {
            console.error('[Cartera] Error cargando Supabase:', e);
        }
    },

    cargarDatosLocal() {
        const saved = localStorage.getItem('dolarve_cartera_v4');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.perfiles = data.perfiles || [];
                this.perfilActivoId = data.perfilActivoId || (this.perfiles[0]?.id || null);
                this.monedaActiva = data.monedaActiva || 'USD';
            } catch (e) {}
        }
    },

    // --- GESTIÓN DE PERFILES ---

    crearPerfil(nombre, icono, color = '#1e113a') {
        const nuevo = {
            id: 'p_' + Date.now(),
            nombre: nombre,
            icono: icono,
            color: color,
            balances: { USD:0, VES:0, USDT:0, EUR:0 },
            movimientos: [],
            creado: new Date().toISOString()
        };
        this.perfiles.push(nuevo);
        this.perfilActivoId = nuevo.id;
        this.guardarDatos();
        this.renderizar();
        return nuevo;
    },

    abrirModalPerfil(editId = null) {
        const modal = document.getElementById('p-profile-modal-overlay');
        const title = document.getElementById('p-profile-modal-title');
        const input = document.getElementById('p-profile-name');
        
        if (editId) {
            const p = this.perfiles.find(x => x.id === editId);
            title.innerText = "Editar Perfil";
            input.value = p.nombre;
            input.dataset.editId = editId;
            // Activar color e icono
            document.querySelectorAll('.color-chip').forEach(c => {
                c.classList.toggle('active', c.dataset.color === p.color);
            });
            document.querySelectorAll('.icon-chip').forEach(i => {
                i.classList.toggle('active', i.dataset.icon === p.icono);
            });
        } else {
            title.innerText = "Nuevo Perfil";
            input.value = "";
            delete input.dataset.editId;
        }
        
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    },

    cerrarModalPerfil() {
        const modal = document.getElementById('p-profile-modal-overlay');
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300);
    },

    confirmarNuevoPerfil() {
        const input = document.getElementById('p-profile-name');
        const nombre = input.value;
        const icono = document.querySelector('.icon-chip.active')?.dataset.icon || 'ph-fill ph-user';
        const color = document.querySelector('.color-chip.active')?.dataset.color || '#1e113a';
        const editId = input.dataset.editId;

        if (!nombre) return;

        if (editId) {
            const p = this.perfiles.find(x => x.id === editId);
            p.nombre = nombre;
            p.icono = icono;
            p.color = color;
        } else {
            this.crearPerfil(nombre, icono, color);
        }

        this.guardarDatos();
        this.renderizar();
        this.cerrarModalPerfil();
        this.cerrarSelectorPerfiles();
    },

    abrirSelectorPerfiles() {
        const overlay = document.getElementById('cv-profile-selector-overlay');
        const list = document.getElementById('cv-profiles-list');
        
        list.innerHTML = this.perfiles.map(p => `
            <div class="cv-profile-item ${p.id === this.perfilActivoId ? 'active' : ''}" onclick="Cartera.cambiarPerfil('${p.id}')">
                <div class="cv-profile-icon" style="background: ${p.color}">
                    <i class="${p.icono}"></i>
                </div>
                <div class="cv-profile-details">
                    <span class="p-name">${p.nombre}</span>
                    <span class="p-balance">$ ${this.calcularPatrimonioTotalUSD(p).toLocaleString('es-VE', {minimumFractionDigits:2})}</span>
                </div>
                <div class="cv-profile-actions">
                    <div class="cv-profile-edit-btn" onclick="event.stopPropagation(); Cartera.abrirModalPerfil('${p.id}')">
                        <i class="ph-bold ph-pencil-simple"></i>
                    </div>
                    ${this.perfiles.length > 1 ? `
                    <div class="cv-profile-delete-btn" onclick="event.stopPropagation(); Cartera.eliminarPerfil('${p.id}')" style="color: #ff4d4d; opacity: 0.7; padding: 5px;">
                        <i class="ph-bold ph-trash"></i>
                    </div>
                    ` : ''}
                </div>
            </div>
        `).join('');

        overlay.style.display = 'flex';
        setTimeout(() => overlay.classList.add('active'), 10);
    },

    cerrarSelectorPerfiles() {
        const overlay = document.getElementById('cv-profile-selector-overlay');
        overlay.classList.remove('active');
        setTimeout(() => overlay.style.display = 'none', 300);
    },

    cambiarPerfil(id) {
        this.perfilActivoId = id;
        this.guardarDatos();
        this.renderizar();
        this.cerrarSelectorPerfiles();
        
        // Efecto visual de cambio
        this.mostrarLoader();
        setTimeout(() => this.ocultarLoader(), 500);
    },

    eliminarPerfil(id) {
        if (this.perfiles.length <= 1) {
            Interfaz.mostrarNotificacion('⚠️ No puedes eliminar el último perfil.');
            return;
        }

        const perfil = this.perfiles.find(p => p.id === id);
        if (!confirm(`¿Seguro que quieres borrar el perfil "${perfil.nombre}"? Se perderán todos sus movimientos.`)) return;

        this.perfiles = this.perfiles.filter(p => p.id !== id);
        
        // Si borramos el activo, pasamos al primero de la lista
        if (this.perfilActivoId === id) {
            this.perfilActivoId = this.perfiles[0].id;
        }

        this.guardarDatos();
        this.renderizar();
        this.abrirSelectorPerfiles(); // Refrescar lista
        Interfaz.mostrarNotificacion('Perfil eliminado correctamente.');
    },

    // --- OPERACIONES ---

    abrirModal(tipo) {
        this.operacionActual = tipo;
        const modal = document.getElementById('p-op-modal-overlay');
        document.getElementById('p-op-title').innerText = tipo === 'IN' ? 'Registrar Ingreso' : 'Registrar Gasto';
        document.getElementById('p-op-amount').value = '';
        document.getElementById('p-op-category').value = '';
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
        this.checkConversionBox();
    },

    cerrarModal() {
        const modal = document.getElementById('p-op-modal-overlay');
        modal.classList.remove('active');
        setTimeout(() => modal.style.display = 'none', 300);
    },

    confirmarOperacion() {
        const monto = parseFloat(document.getElementById('p-op-amount').value);
        const moneda = document.getElementById('p-op-currency').value;
        const cat = document.getElementById('p-op-category').value || 'General';

        if (isNaN(monto) || monto <= 0) return;

        const perfil = this.getPerfilActivo();
        perfil.movimientos.push({
            id: 'mv_' + Date.now(),
            tipo: this.operacionActual,
            monto: monto,
            moneda: moneda,
            concepto: cat,
            fecha: new Date().toISOString()
        });

        this.guardarDatos();
        this.renderizar();
        this.cerrarModal();
    },

    checkConversionBox() {
        const moneda = document.getElementById('p-op-currency').value;
        const box = document.getElementById('p-conversion-box');
        const text = document.getElementById('p-conversion-text');
        const monto = parseFloat(document.getElementById('p-op-amount').value) || 0;
        
        if (moneda === 'VES') {
            const tasa = window.DolarVE?.tasas?.usd || 1; // Usar 'usd' como tasa BCV
            text.innerText = `Equivale a: $ ${(monto / tasa).toFixed(2)}`;
            box.style.display = 'flex';
        } else {
            // Si la moneda es USD/USDT/EUR, mostrar el equivalente en VES según la tasa BCV
            const tasa = window.DolarVE?.tasas?.usd || 1;
            text.innerText = `Equivale a: Bs ${ (monto * tasa).toLocaleString('es-VE', {minimumFractionDigits:2}) }`;
            box.style.display = 'flex';
        }
    },

    // --- MOTOR RENDER ---

    getPerfilActivo() {
        return this.perfiles.find(p => p.id === this.perfilActivoId) || this.perfiles[0];
    },

    calcularPatrimonioTotalUSD(perfil) {
        let total = 0;
        const balances = { USD: 0, VES: 0, USDT: 0, EUR: 0 };
        perfil.movimientos.forEach(m => {
            if (m.tipo === 'IN') balances[m.moneda] += m.monto;
            else balances[m.moneda] -= m.monto;
        });
        
        const tasas = window.DolarVE?.tasas || {};
        total += balances.USD + balances.USDT;
        total += balances.VES / (tasas.usd || 1); // Usar 'usd' como tasa BCV
        total += balances.EUR * (tasas.eur / tasas.usd || 1.1); // Proporción EUR/USD si es necesario o directa
        return total;
    },

    renderizar() {
        const perfil = this.getPerfilActivo();
        if (!perfil) return;

        // Actualizar UI Camaleón (Radial Gradient v7.2)
        document.documentElement.style.setProperty('--cv-profile-color', perfil.color);

        // Render Card Principal (Layout Horizontal v7.2)
        const card = document.getElementById('cv-active-profile-card');
        if (card) {
            const total = this.monedaActiva === 'TOTAL' ? this.calcularPatrimonioTotalUSD(perfil) : this.getSaldoMoneda(perfil, this.monedaActiva);
            const simbolo = this.getSimbolo(this.monedaActiva);
            
            card.innerHTML = `
                <div class="cv-profile-header-main">
                    <div class="cv-icon-main" style="background: ${perfil.color}66; color: #fff; border: 2px solid ${perfil.color}88;">
                        <i class="${perfil.icono}"></i>
                    </div>
                    <span class="cv-profile-name-tag">${perfil.nombre}</span>
                </div>
                <div class="cv-balance-hero">
                    <span class="cv-hero-symbol">${simbolo}</span>
                    <h2 class="cv-hero-amount">${total.toLocaleString('es-VE', {minimumFractionDigits:2})}</h2>
                </div>
                ${this.monedaActiva !== 'VES' ? `
                <div class="cv-balance-equivalency" onclick="Cartera.alternarTasaReferencia()" style="cursor: pointer; display: flex; align-items: center; gap: 8px; justify-content: center; margin-top: -5px; opacity: 0.8;">
                    <span style="font-size: 13px; font-weight: 600; color: #fff;">
                       ≈ Bs ${ (total * (this.tasaPreferenciaRef === 'BCV' ? (window.DolarVE?.tasas?.usd || 1) : (window.DolarVE?.tasas?.paralelo || (window.DolarVE?.tasas?.usd || 1)))) .toLocaleString('es-VE', {minimumFractionDigits:2}) }
                    </span>
                    <span style="font-size: 9px; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; color: ${this.tasaPreferenciaRef === 'BCV' ? 'var(--cv-green)' : '#ffcc00'}; font-weight: 800; text-transform: uppercase;">
                        ${this.tasaPreferenciaRef}
                    </span>
                </div>
                ` : ''}
            `;
        }

        // Renderizar Gráfico v7.2 (ApexCharts)
        this.renderizarGrafico(perfil);

        // Selector de Monedas (Chips Premium)
        const tabs = document.getElementById('portfolio-wallet-tabs');
        if (tabs) {
            const currs = ['TOTAL', 'USD', 'VES', 'USDT', 'EUR'];
            tabs.innerHTML = currs.map(c => `
                <div class="cv-tab ${this.monedaActiva === c ? 'active' : ''}" onclick="Cartera.cambiarMoneda('${c}')">${c}</div>
            `).join('');
        }

        this.renderizarHistorial(perfil);
    },

    renderizarGrafico(perfil) {
        const container = document.getElementById('cv-main-chart');
        if (!container || !window.ApexCharts) return;

        container.innerHTML = ""; // Limpiar grafico anterior

        // Datos de los últimos 7 días o últimos 7 movimientos
        let movs = [...perfil.movimientos].sort((a,b) => new Date(a.fecha) - new Date(b.fecha));
        if (this.monedaActiva !== 'TOTAL') {
            movs = movs.filter(m => m.moneda === this.monedaActiva);
        }
        
        let historialSaldo = [];
        let saldoAcumulado = 0;
        
        movs.forEach(m => {
            saldoAcumulado += (m.tipo === 'IN' ? m.monto : -m.monto);
            historialSaldo.push(saldoAcumulado);
        });

        // Relleno si no hay suficientes datos para tendencia
        if (historialSaldo.length < 5) {
            historialSaldo = [...new Array(5 - historialSaldo.length).fill(0), ...historialSaldo];
        }

        const options = {
            series: [{ name: 'Balance', data: historialSaldo.slice(-10) }],
            chart: {
                type: 'area',
                height: 60,
                sparkline: { enabled: true },
                animations: { enabled: true, easing: 'easeinout', speed: 800 }
            },
            stroke: { curve: 'smooth', width: 2, colors: [perfil.color || '#00d084'] },
            fill: {
                type: 'gradient',
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.3,
                    opacityTo: 0,
                    stops: [0, 90, 100]
                }
            },
            colors: [perfil.color || '#00d084'],
            tooltip: { enabled: false }
        };

        const chart = new ApexCharts(container, options);
        chart.render();
    },

    getSaldoMoneda(perfil, mon) {
        let saldo = 0;
        perfil.movimientos.filter(m => m.moneda === mon).forEach(m => {
            saldo += (m.tipo === 'IN' ? m.monto : -m.monto);
        });
        return saldo;
    },

    getSimbolo(mon) {
        if (mon === 'VES') return 'Bs';
        if (mon === 'EUR') return '€';
        return '$';
    },

    cambiarMoneda(m) {
        this.monedaActiva = m;
        this.renderizar();
    },

    alternarTasaReferencia() {
        this.tasaPreferenciaRef = this.tasaPreferenciaRef === 'BCV' ? 'PARALELO' : 'BCV';
        if (window.navigator.vibrate) window.navigator.vibrate(10);
        this.renderizar();
        Interfaz.mostrarNotificacion(`Tasa de referencia: ${this.tasaPreferenciaRef}`);
    },

    renderizarHistorial(perfil) {
        const list = document.getElementById('portfolio-history-list');
        let movs = [...perfil.movimientos].reverse();
        if (this.monedaActiva !== 'TOTAL') {
            movs = movs.filter(m => m.moneda === this.monedaActiva);
        }
        
        if (movs.length === 0) {
            list.innerHTML = `<div class="cv-empty-msg">No hay actividad en ${this.monedaActiva}</div>`;
            return;
        }

        list.innerHTML = movs.slice(0, 10).map(m => `
            <div class="cv-history-item ${m.tipo === 'IN' ? 'in' : 'out'}">
                <div class="cv-hist-icon"><i class="ph-bold ${m.tipo === 'IN' ? 'ph-arrow-down-left' : 'ph-arrow-up-right'}"></i></div>
                <div class="cv-hist-info">
                    <span class="h-concept">${m.concepto}</span>
                    <span class="h-date">${new Date(m.fecha).toLocaleDateString()}</span>
                </div>
                <div class="cv-hist-value">
                    ${m.tipo === 'IN' ? '+' : '-'}${m.monto.toLocaleString('es-VE', {minimumFractionDigits:2})}
                </div>
            </div>
        `).join('');
    },

    abrirModalHistorial() {
        const modal = document.getElementById('cv-history-modal-overlay');
        if (!modal) return;
        
        this.renderizarHistorialCompleto();
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    },

    cerrarModalHistorial() {
        const modal = document.getElementById('cv-history-modal-overlay');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.style.display = 'none', 300);
        }
    },

    renderizarHistorialCompleto() {
        const list = document.getElementById('cv-full-history-list');
        const perfil = this.getPerfilActivo();
        if (!list || !perfil) return;

        let movs = [...perfil.movimientos].reverse();
        
        if (movs.length === 0) {
            list.innerHTML = `<div class="cv-empty-msg">No hay movimientos registrados todavía.</div>`;
            return;
        }

        list.innerHTML = movs.map(m => `
            <div class="cv-history-item ${m.tipo === 'IN' ? 'in' : 'out'}">
                <div class="cv-hist-icon"><i class="ph-bold ${m.tipo === 'IN' ? 'ph-arrow-down-left' : 'ph-arrow-up-right'}"></i></div>
                <div class="cv-hist-info">
                    <span class="h-concept">${m.concept || m.concepto}</span>
                    <span class="h-date">${new Date(m.fecha).toLocaleDateString()} · ${m.moneda}</span>
                </div>
                <div class="cv-hist-value">
                    ${m.tipo === 'IN' ? '+' : '-'}${m.monto.toLocaleString('es-VE', {minimumFractionDigits:2})} ${m.moneda === 'VES' ? 'Bs' : '$'}
                </div>
            </div>
        `).join('');
    }
};

window.Cartera = Cartera;
