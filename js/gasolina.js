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

                    // Obtener nombre de la zona del usuario via geocodificación inversa
                    let zonaNombre = 'Venezuela';
                    try {
                        const geoResp = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&accept-language=es`);
                        const geoData = await geoResp.json();
                        zonaNombre = geoData.address?.city || geoData.address?.town || geoData.address?.state || geoData.address?.county || 'Venezuela';
                    } catch(e) { console.warn('[DolarVE] Geocoding fallback'); }

                    const cercanas = estacionesOSM.map(est => {
                        const dist = this.calcularDistancia(lat, lng, est.lat, est.lon);
                        // Intentar múltiples tags de OSM para la ciudad
                        const ciudad = est.tags["addr:city"] || est.tags["addr:municipality"] || est.tags["addr:state"] || est.tags["is_in:city"] || est.tags["is_in:state"] || zonaNombre;
                        return {
                            id: est.id,
                            name: est.tags.name || `E/S ${est.tags.operator || est.tags.brand || 'Sin Nombre'}`,
                            city: ciudad,
                            latitude: est.lat,
                            longitude: est.lon,
                            distancia: dist
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

        container.innerHTML = `
            <div class="gas-list" style="display: flex; flex-direction: column; gap: 12px;">
                ${estaciones.map((est, idx) => {
                    const distText = est.distancia < 1 
                        ? `${(est.distancia * 1000).toFixed(0)}m` 
                        : `${est.distancia.toFixed(1)}km`;

                    return `
                    <div class="gas-station-card" style="animation: fadeInUp 0.4s ease ${idx * 0.05}s both;">
                        <div class="gas-card-header" onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${est.latitude || est.lat},${est.longitude || est.lng}', '_blank')">
                            <div style="flex: 1; min-width: 0;">
                                <div class="gas-name">${est.name || est.nombre}</div>
                                <div class="gas-city">${est.city || est.ciudad || 'Venezuela'}</div>
                            </div>
                            <div class="gas-distance-pill">
                                <i class="ph ph-navigation-arrow"></i> ${distText}
                            </div>
                        </div>

                        <div class="gas-card-footer">
                            <div class="gas-distance" onclick="event.stopPropagation(); window.open('https://www.google.com/maps/dir/?api=1&destination=${est.latitude || est.lat},${est.longitude || est.lng}', '_blank')">
                                <i class="ph ph-navigation-arrow"></i> Navegar con GPS
                            </div>
                            <div class="gas-update-time">
                                <i class="ph ph-map-pin"></i> ${est.city}
                            </div>
                        </div>
                    </div>
                `}).join('')}
            </div>
        `;
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
