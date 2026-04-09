/**
 * DolarVE - Módulo de Noticias e Insights v12.0
 * Encargado de la gestión de RSS, Tickers y la nueva Línea de Tiempo.
 */

const Noticias = {
    items: [],
    actualizadas: null,

    async init() {
        console.log('[DolarVE] Inicializando Módulo de Noticias...');
        await this.obtener();
        this.iniciarAutoRefresh();
    },

    async obtener() {
        const feedContainer = document.getElementById('news-feed');
        if (!feedContainer) return;

        console.log('[DolarVE] Buscando noticias frescas en el mercado...');

        const fuentes = [
            { url: 'https://www.bancaynegocios.com/feed/', name: 'Banca y Negocios', color: '#00D084' },
            { url: 'https://www.descifrado.com/feed/', name: 'Descifrado', color: '#3E8BFF' },
            { url: 'https://finanzasdigital.com/feed/', name: 'Finanzas Digital', color: '#FFB800' },
            { url: 'https://es.cointelegraph.com/rss', name: 'CoinTelegraph', color: '#F7931A' },
            { url: 'https://www.elnacional.com/economia/feed/', name: 'El Nacional', color: '#E74C3C' }
        ];

        let todasLasNoticias = [];

        for (const fuente of fuentes) {
            try {
                const rssUrl = encodeURIComponent(fuente.url);
                const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}&t=${Date.now()}`);
                const data = await response.json();

                if (data.status === 'ok' && data.items.length > 0) {
                    const itemsConFuente = data.items.slice(0, 6).map(item => ({
                        ...item,
                        fuenteApp: fuente.name,
                        fuenteColor: fuente.color
                    }));
                    todasLasNoticias = [...todasLasNoticias, ...itemsConFuente];
                }
            } catch (e) {
                console.warn(`[DolarVE] Falló fuente ${fuente.name}:`, e);
            }
        }

        if (todasLasNoticias.length > 0) {
            // Ordenar por fecha (más reciente primero)
            todasLasNoticias.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
            this.items = todasLasNoticias;
            this.actualizadas = new Date();

            this.renderCarousel();
            this.renderTimeline();
            this.renderTicker();
            this.iniciarAutoScroll();
            this.generarAnalisisMercado();
            this.actualizarSentimientoGlobal();
        } else {
            this.renderError();
        }
    },

    generarAnalisisMercado() {
        const cardParent = document.getElementById('daily-insight');
        const titleEl = document.getElementById('insight-title');
        const bodyEl = document.getElementById('insight-body');
        if (!titleEl || !bodyEl || !cardParent || !window.DolarVE) return;

        const bcv = window.DolarVE.tasas?.usd || 0;
        const binance = window.DolarVE.tasas?.binance || 0;
        if (bcv <= 0 || binance <= 0) return;

        const brecha = ((binance - bcv) / bcv) * 100;
        let analisis = "";
        let titulo = "Fuerza del Mercado";

        // Reset state
        cardParent.classList.remove('alert-high');

        if (brecha > 12) {
            titulo = "⚠️ Brecha Elevada";
            analisis = `La diferencia entre el oficial y paralelo es del ${brecha.toFixed(2)}%. Se recomienda cautela.`;
            cardParent.classList.add('alert-high');
        } else if (brecha > 5) {
            titulo = "📊 Mercado Activo";
            analisis = `La brecha se mantiene estable en el ${brecha.toFixed(2)}%. Flujo comercial regular.`;
        } else {
            titulo = "✅ Mercado Estable";
            analisis = "Tasas oficial y paralela en alta convergencia. Escenario de baja volatilidad.";
        }

        titleEl.innerText = titulo;
        bodyEl.innerText = analisis;
        this.actualizarIndicadoresMercado(brecha);
    },

    actualizarIndicadoresMercado(brecha) {
        const volatilityTag = document.getElementById('market-volatility-tag');
        const strengthVal = document.getElementById('market-strength-val');
        const strengthFill = document.getElementById('market-strength-fill');
        if (!volatilityTag || !strengthVal || !strengthFill) return;

        let riesgo = "ESTABLE";
        let color = "var(--accent-green)";
        let icon = "ph-shield-check";

        if (brecha > 12) {
            riesgo = "ALERTA";
            color = "#ff4d4d";
            icon = "ph-warning-octagon";
        } else if (brecha > 6) {
            riesgo = "VOLÁTIL";
            color = "#f39c12";
            icon = "ph-chart-line-up";
        }

        volatilityTag.style.color = color;
        volatilityTag.innerHTML = `<i class="ph-duotone ${icon}"></i> ${riesgo}`;

        const fuerza = Math.max(100 - (brecha * 2.5), 10);
        strengthVal.innerText = `${fuerza.toFixed(0)}%`;
        strengthFill.style.width = `${fuerza}%`;
        strengthFill.style.background = color;
        strengthFill.style.boxShadow = `0 0 10px ${color}`;
    },

    renderCarousel() {
        const feedContainer = document.getElementById('news-feed');
        if (!feedContainer) return;

        // Las top 5 van al carrusel
        const topNews = this.items.slice(0, 5);

        feedContainer.innerHTML = topNews.map(news => {
            const fecha = new Date(news.pubDate).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
            const tituloLimpio = this.limpiarTexto(news.title);
            const categoria = news.categories && news.categories.length > 0 ? news.categories[0] : 'ECONOMÍA';

            return `
                <div class="news-item-elite" onclick="window.open('${news.link}', '_blank')">
                    <div class="news-pill">${categoria}</div>
                    <div class="news-title-elite">${tituloLimpio}</div>
                    <div class="news-footer">
                        <span class="news-source" style="color: ${news.fuenteColor}">${news.fuenteApp}</span>
                        <span class="news-date">${fecha}</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    /**
     * RENDER TIMELINE: La nueva sección "Brutal"
     */
    renderTimeline() {
        const timelineContainer = document.getElementById('news-timeline');
        if (!timelineContainer) return;

        // De la 6 en adelante van al timeline (ahora tenemos más fuentes)
        const timelineNews = this.items.slice(5, 20);

        if (timelineNews.length === 0) {
            timelineContainer.innerHTML = '<p class="timeline-empty">Más noticias en camino...</p>';
            return;
        }

        timelineContainer.innerHTML = timelineNews.map((news, index) => {
            const tiempoRelativo = this.calcularTiempoRelativo(news.pubDate);
            const tituloLimpio = this.limpiarTexto(news.title);
            
            // --- Inteligencia DolarVE: Detección de Impacto ---
            const esHot = /sube|baja|alza|dólar|bcv|inflación|récord|crisis|urgente/i.test(tituloLimpio);
            const esCrypto = news.fuenteApp === 'CoinTelegraph';
            const esNuevo = this.esNoticiaReciente(news.pubDate);

            let statusHtml = '';
            if (esNuevo) statusHtml += '<span class="badge-live">VIVO 🟢</span>';
            if (esHot) statusHtml += '<span class="badge-hot">CRÍTICO 🔥</span>';
            if (esCrypto) statusHtml += '<span class="badge-crypto">CRYPTO ⚡</span>';

            return `
                <div class="timeline-item ${esHot ? 'hot-news' : ''}" onclick="window.open('${news.link}', '_blank')" style="--item-index: ${index}">
                    <div class="timeline-marker" style="background: ${news.fuenteColor}"></div>
                    <div class="timeline-content">
                        <div class="timeline-meta">
                            <span class="timeline-source" style="color: ${news.fuenteColor}">${news.fuenteApp}</span>
                            <span class="timeline-time">${tiempoRelativo}</span>
                        </div>
                        <div class="timeline-status-row">${statusHtml}</div>
                        <div class="timeline-title">${tituloLimpio}</div>
                    </div>
                </div>
            `;
        }).join('');
    },

    actualizarSentimientoGlobal() {
        const statusEl = document.querySelector('.timeline-status');
        if (!statusEl) return;

        // Contamos cuántas noticias "Hot" hay en las últimas 15
        const hotCount = this.items.slice(0, 15).filter(n => /sube|baja|alza|dólar|bcv|inflación|récord/i.test(n.title)).length;
        
        let sentiment = "ESTABLE";
        if (hotCount > 5) sentiment = "TENSO ⚡";
        else if (hotCount > 2) sentiment = "ACTIVO 📊";

        statusEl.innerText = `MERCADO ${sentiment}`;
    },

    esNoticiaReciente(fechaStr) {
        const diff = new Date() - new Date(fechaStr);
        return diff < 1800000; // Menos de 30 minutos
    },

    renderTicker() {
        const tickerContainer = document.getElementById('news-ticker-container');
        const tickerContent = document.getElementById('home-news-ticker');
        if (!tickerContainer || !tickerContent) return;

        const tickerHTML = this.items.slice(0, 5).map(news => {
            const tituloLimpio = this.limpiarTexto(news.title);
            return `
                <div class="ticker-item" onclick="Principal.navegar('insights-section')">
                    <div class="ticker-dot"></div>
                    ${tituloLimpio}
                </div>
            `;
        }).join('');

        tickerContent.innerHTML = tickerHTML + tickerHTML;
        tickerContainer.style.display = 'block';
    },

    limpiarTexto(texto) {
        if (!texto) return '';
        return texto
            .replace(/&quot;/g, '"')
            .replace(/&#8211;/g, '-')
            .replace(/&#8220;/g, '"')
            .replace(/&#8221;/g, '"')
            .replace(/&#8230;/g, '...')
            .replace(/&amp;/g, '&')
            .replace(/&#038;/g, '&');
    },

    calcularTiempoRelativo(fechaStr) {
        const fecha = new Date(fechaStr);
        const ahora = new Date();
        const diffMs = ahora - fecha;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHoras = Math.floor(diffMins / 60);
        const diffDias = Math.floor(diffHoras / 24);

        if (diffMins < 1) return 'Hace un momento';
        if (diffMins < 60) return `Hace ${diffMins} min`;
        if (diffHoras < 24) return `Hace ${diffHoras} ${diffHoras === 1 ? 'hora' : 'horas'}`;
        if (diffDias < 7) return `Hace ${diffDias} ${diffDias === 1 ? 'día' : 'días'}`;
        
        return fecha.toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
    },

    iniciarAutoScroll() {
        const feed = document.getElementById('news-feed');
        if (!feed || feed.dataset.scrolling === 'true') return;

        feed.dataset.scrolling = 'true';
        setInterval(() => {
            const currentScreen = document.querySelector('.screen.active');
            if (currentScreen && currentScreen.id !== 'insights-section') return;

            const currentScroll = feed.scrollLeft;
            const maxScroll = feed.scrollWidth - feed.clientWidth;

            if (currentScroll >= maxScroll - 5) {
                feed.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                feed.scrollBy({ left: 300, behavior: 'smooth' });
            }
        }, 8000);
    },

    iniciarAutoRefresh() {
        // Refrescar cada 15 minutos
        setInterval(() => this.obtener(), 900000);
    },

    renderError() {
        const feedContainer = document.getElementById('news-feed');
        if (feedContainer) {
            feedContainer.innerHTML = `
                <div style="padding: 40px 20px; text-align: center; color: var(--text-muted); width: 100%;">
                    <i class="ph-duotone ph-rss-slash" style="font-size: 32px; margin-bottom: 10px; opacity: 0.5;"></i>
                    <p style="font-size: 13px;">No hay conexión con el mercado.</p>
                </div>
            `;
        }
    }
};

// Exportar globalmente
window.Noticias = Noticias;
