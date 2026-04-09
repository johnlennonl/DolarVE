// ==========================================
// Módulo de Bancos - DolarVE
// Maneja las tasas por mesas de cambio
// ==========================================

const Bancos = {
    async obtenerTasasBancos() {
        const listContainer = document.getElementById('dynamic-banks-list');
        if (!listContainer) return;

        try {
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
    }
};

window.Bancos = Bancos;
