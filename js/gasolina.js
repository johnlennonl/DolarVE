// ==========================================
// Módulo Gasolina - DolarVE
// Maneja mapas OSM, Supabase y Calculadora Surtidor
// ==========================================

const Gasolina = {
    estacionesCercanasCache: [],

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
                    const radius = document.getElementById('gas-radius-select')?.value || 20000;
                    let estacionesOSM = await this.fetchDesdeOSM(lat, lng, radius);
                    let reportesStatus = {};

                    if (window.DolarVE.supabase && estacionesOSM.length > 0) {
                        const osmIds = estacionesOSM.map(e => e.id);
                        const { data, error } = await window.DolarVE.supabase
                            .from('gas_stations')
                            .select('id, status, last_updated, reports_count')
                            .in('id', osmIds);
                        
                        if (!error && data) {
                            data.forEach(r => { reportesStatus[r.id] = r; });
                        }
                    }

                    const cercanas = estacionesOSM.map(est => {
                        const dist = this.calcularDistancia(lat, lng, est.lat, est.lon);
                        const statusData = reportesStatus[est.id] || {};
                        return {
                            id: est.id,
                            name: est.tags.name || `E/S ${est.tags.operator || 'Sin Nombre'}`,
                            city: est.tags["addr:city"] || 'Tu Zona',
                            latitude: est.lat,
                            longitude: est.lon,
                            distancia: dist,
                            status: statusData.status || 'Operativa',
                            last_updated: statusData.last_updated || null,
                            reports_count: statusData.reports_count || 0,
                            source: 'OpenStreetMap'
                        };
                    }).sort((a, b) => a.distancia - b.distancia);

                    if (cercanas.length === 0) {
                        this.mostrarEstadoVacioGasolina(container);
                    } else {
                        this.renderizarEstaciones(cercanas.slice(0, 10));
                    }
                } catch (e) {
                    console.error('[DolarVE] Error fetch global gas:', e);
                    this.mostrarErrorGas(container, "Error al conectar con el mapa global.");
                }
            },
            (err) => {
                this.mostrarErrorGas(container, err.code === 1 ? 'Ubicación denegada. Actívala en ajustes.' : 'Error al obtener ubicación.');
            },
            { timeout: 15000, enableHighAccuracy: true, maximumAge: 0 }
        );
    },

    async fetchDesdeOSM(lat, lng, radius = 20000) {
        const query = `
            [out:json][timeout:30];
            (
                node["amenity"="fuel"](around:${radius}, ${lat}, ${lng});
                way["amenity"="fuel"](around:${radius}, ${lat}, ${lng});
                relation["amenity"="fuel"](around:${radius}, ${lat}, ${lng});
            );
            out center;
        `;
        
        const data = await this.fetchConRespaldo(query);
        if (!data || !data.elements) return [];

        return data.elements.map(el => {
            const coords = el.type === 'node' ? { lat: el.lat, lon: el.lon } : { lat: el.center.lat, lon: el.center.lon };
            return { ...el, ...coords };
        });
    },

    async fetchConRespaldo(query) {
        const endpoints = [
            'https://overpass-api.de/api/interpreter',
            'https://lz4.overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
            'https://overpass-api.de/api/interpreter'
        ];

        for (const url of endpoints) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    body: `data=${encodeURIComponent(query)}`,
                    signal: AbortSignal.timeout(10000)
                });
                if (response.ok) return await response.json();
                console.warn(`[DolarVE] Servidor ${url} saturado. Saltando...`);
            } catch (e) {
                console.warn(`[DolarVE] Fallo conexión con ${url}. Reintentando...`);
            }
        }
        throw new Error('Todos los servidores fallaron');
    },

    mostrarErrorGas(container, mensaje) {
        container.innerHTML = `
            <div class="card" style="margin: 0; padding: 25px; text-align: center; background: rgba(255, 77, 77, 0.05); border: 1px dashed rgba(255, 77, 77, 0.2);">
                <i class="ph-duotone ph-map-pin-slash" style="font-size: 32px; color: var(--accent-red); margin-bottom: 15px;"></i>
                <div style="font-size: 13px; color: var(--text-main); font-weight: 700;">${mensaje}</div>
                <button onclick="Gasolina.obtenerEstacionesCercanas(true)" class="btn-primary" style="margin-top: 15px; background: var(--accent-red); width: 100%;">Reintentar</button>
            </div>
        `;
    },

    calcularDistancia(lat1, lon1, lat2, lon2) {
        const R = 6371;
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
                <button onclick="Gasolina.obtenerEstacionesCercanas(true)" class="btn-primary" style="width: 100%; background: #3498db; color: #fff; padding: 12px; font-size: 13px;">Activar Ubicación</button>
            </div>
        `;
    },

    mostrarEstadoVacioGasolina(container) {
        container.innerHTML = `
            <div class="no-stations-card">
                <i class="ph-duotone ph-map-pin-line no-stations-icon"></i>
                <div class="no-stations-title">No hay bombas cerca</div>
                <div class="no-stations-text">
                    No hemos detectado estaciones en tu zona (radio 80km).
                </div>
            </div>
        `;
    },

    renderizarEstaciones(estaciones) {
        const container = document.getElementById('nearby-gas-stations');
        if (!container) return;

        this.estacionesCercanasCache = estaciones;
        const zoneLabel = estaciones.length > 0 ? estaciones[0].city : 'Tu Zona';

        container.innerHTML = `
            <div style="font-size: 11px; color: var(--text-muted); font-weight: 800; text-transform: uppercase; margin-bottom: 18px; display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="ph-duotone ph-gas-pump" style="color: var(--accent-green); font-size: 18px;"></i> Bombas Cercanas (${zoneLabel})
                </div>
                <button onclick="Gasolina.obtenerEstacionesCercanas(true)" style="background: none; border: none; cursor: pointer; color: var(--accent-green); display: flex; align-items: center; gap: 5px;">
                    <span id="update-indicator-gas" style="font-size: 9px; font-weight: 800;">RECARGAR</span>
                    <i class="ph ph-arrows-clockwise" style="font-size: 14px;"></i>
                </button>
            </div>
            <div class="gas-list" style="display: flex; flex-direction: column; gap: 12px;">
                ${estaciones.map(est => {
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
                                <div style="font-size: 8px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; opacity: 0.7;">📍 ${est.source || 'Mapa Local'}</div>
                            </div>
                            <div class="gas-status-badge ${statusClass}">
                                ${est.status}
                            </div>
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

        if (fuelFill) {
            const porcentaje = (litrosNueva / 120) * 100;
            fuelFill.style.height = `${porcentaje}%`;
        }

        if (bubbleContainer) {
            this.generarBurbujas(bubbleContainer);
        }

        const animarValor = (elemento, valorFinal, decimales = 2, sufijo = "") => {
            const soloDigitos = elemento.innerText.replace(/[^\d]/g, '');
            const valorInicial = (parseFloat(soloDigitos) || 0) / Math.pow(10, decimales);
            
            const duracion = 500; 
            const inicio = performance.now();

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

        animarValor(pumpLitersEl, litrosNueva, 1);

        if (pumpTotalUsdEl) pumpTotalUsdEl.innerText = `${totalUsd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
        if (pumpTotalVesEl && window.DolarVE.tasas.usd > 0) {
            pumpTotalVesEl.innerText = `${totalVes.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs`;
        }
    },

    generarBurbujas(container) {
        if (Math.random() > 0.3) return;
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
    }
};

window.refreshPump = () => Gasolina.refrescarSurtidor();
window.updatePump = (litros) => {
    const slider = document.getElementById('pump-slider');
    if (slider) {
        slider.value = litros;
        Gasolina.refrescarSurtidor();
    }
};
window.Gasolina = Gasolina;
