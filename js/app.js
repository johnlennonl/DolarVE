// ==========================================
// ¡Epa! Este es el Director de Orquesta de DolarVE.
// Aquí arrancamos todos los motores cuando la página carga.
// ==========================================

const Principal = {
    // Función de arranque de la aplicación
    async inicializar() {
        console.log('[DolarVE] ¡Arrancando motores, papá! 🚀');

        // 1. Cargamos el tema (Luz u Oscuridad)
        Interfaz.cargarTemaGuardado();
        
        // 2. Quitamos el Splash Screen después de un ratico
        setTimeout(() => {
            Interfaz.ocultarSplashScreen();
        }, 2000);

        // 3. Activamos la navegación y botones principales (Refactorizado con Master Hub)
        Interfaz.inicializarNavegacion();
        this.configurarBotonesInterfaz();

        // 4. Chequeamos quién está logueado en Supabase
        if (window.DolarVE.supabase) {
            await Autenticacion.verificarSesion();
            Autenticacion.inicializarEscuchaSesion();
        }

        // 5. ¡A buscar los reales! Traemos las tasas de una vez
        Tasas.cargarDatosCache(); 
        await Tasas.obtenerDatosTasas();
        
        // 6. Iniciamos el Surtidor y la Referencia rápida
        Tasas.refrescarSurtidor();
        Tasas.actualizarReferenciaRapida();
        this.generarAnalisisMercado(); 

        // 7. Ponemos a valer las notificaciones y cookies
        Interfaz.inicializarPush();
        Interfaz.verificarCookies();
        
        // 8. PWA e Instalación
        this.inicializarPWA();
        Interfaz.verificarAnuncioActualizacion();

        // 9. Noticias y Análisis (DolarVE Insights)
        this.obtenerNoticiasEconomicas();
        
        // 9. Actualización Automática (Tiempo Real) - Cada 5 minutos
        setInterval(() => {
            console.log('[DolarVE] Actualización periódica en curso...');
            Tasas.obtenerDatosTasas();
        }, 300000);
        
        // 10. Mi Cartera v4.0 (NUEVO)
        if (window.Cartera) {
            Cartera.inicializar();
        }

        // 11. Cableado de eventos legales
        this.configurarEventosLegales();
    },

    // Configura lo relacionado a Cookies y Términos
    configurarEventosLegales() {
        const btnAceptar = document.getElementById('accept-cookies-btn');
        if (btnAceptar) btnAceptar.addEventListener('click', () => Interfaz.aceptarCookies());

        const btnVerTerminos = document.getElementById('open-terms-btn') || document.getElementById('view-terms-cookies-btn');
        if (btnVerTerminos) btnVerTerminos.addEventListener('click', () => Interfaz.abrirTerminos());

        const btnCerrarTerminos = document.getElementById('close-terms-modal');
        if (btnCerrarTerminos) btnCerrarTerminos.addEventListener('click', () => Interfaz.cerrarTerminos());

        const btnConfirmarTerminos = document.getElementById('confirm-terms-btn');
        if (btnConfirmarTerminos) btnConfirmarTerminos.addEventListener('click', () => Interfaz.cerrarTerminos());
    },

    // Configura todos los botones sueltos de la interfaz
    configurarBotonesInterfaz() {
        // Botón de Modo Oscuro
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) themeBtn.addEventListener('click', () => Interfaz.alternarModoOscuro());

        // --- NOTIFICACIONES ---
        const bellBtn = document.getElementById('push-bell-btn');
        if (bellBtn) bellBtn.addEventListener('click', () => {
            if (window.navigator.vibrate) window.navigator.vibrate(15);
            Interfaz.alternarSuscripcion();
        });

        const pushToggle = document.getElementById('push-notifications-toggle');
        if (pushToggle) {
            pushToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                if (window.navigator.vibrate) window.navigator.vibrate(15);
                Interfaz.alternarSuscripcion();
            });
        }

        // Botones de la calculadora (Numpad)
        document.querySelectorAll('.calc-btn:not(.action)').forEach(btn => {
            btn.addEventListener('click', () => {
                const valor = btn.getAttribute('data-val') || btn.innerText;
                Calculadora.presionarTecla(valor);
                if (window.navigator.vibrate) window.navigator.vibrate(10);
            });
        });

        // Botones especiales de la calculadora (RECIBO / COBRAR)
        const btnRecibo = document.getElementById('generate-receipt-btn');
        if (btnRecibo) btnRecibo.addEventListener('click', () => Calculadora.generarRecibo());

        const btnCobrar = document.getElementById('generate-charge-btn');
        if (btnCobrar) {
            btnCobrar.addEventListener('click', () => {
                const cuentas = window.DolarVE.cuentas || [];
                if (cuentas.length === 0) {
                    Interfaz.mostrarNotificacion('⚠️ Agrega una cuenta en Ajustes > Gestión de Cuentas');
                    return;
                }
                Calculadora.mostrarSelectorCuenta((cuenta) => {
                    Calculadora.generarSolicitudCobro(cuenta);
                });
            });
        }

        // 10. Botones de Navegación Maestro (NUEVO)
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const screenId = item.getAttribute('data-screen');
                if (screenId) {
                    this.navegar(screenId);
                }
            });
        });

        const hubBtn = document.getElementById('master-hub-btn');
        if (hubBtn) hubBtn.addEventListener('click', () => this.abrirHub());

        const closeHubBtn = document.getElementById('close-hub-btn');
        if (closeHubBtn) closeHubBtn.addEventListener('click', () => this.cerrarHub());

        // Botón de Swap (Cambiar dirección)
        const swapBtn = document.getElementById('swap-currency-btn');
        if (swapBtn) swapBtn.addEventListener('click', () => Calculadora.cambiarDireccion());

        // Botón de Modo Calculadora (Conversor vs Comisiones)
        const modeBtn = document.getElementById('calc-mode-toggle');
        if (modeBtn) modeBtn.addEventListener('click', () => {
            if (window.navigator.vibrate) window.navigator.vibrate(15);
            Calculadora.alternarModo();
        });

        // Chips de moneda (o comisiones) de la calculadora
        document.querySelectorAll('.rate-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                const target = e.target.closest('.rate-chip');
                if (!target) return;
                
                const moneda = target.getAttribute('data-rate');
                const fee = target.getAttribute('data-fee');
                
                if (moneda) {
                    Calculadora.cambiarBase(moneda);
                } else if (fee) {
                    window.DolarVE.config.feeType = fee;
                    document.querySelectorAll('#commission-selector .rate-chip').forEach(c => c.classList.remove('active'));
                    target.classList.add('active');
                    Calculadora.actualizarPantalla();
                }
            });
        });

        // Botones de Referencia Rápida ($100, $500, $1000)
        document.querySelectorAll('.quick-amt-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (window.navigator.vibrate) window.navigator.vibrate(10);
                document.querySelectorAll('.quick-amt-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                Tasas.referenciaRapidaMonto = parseInt(btn.getAttribute('data-amt'));
                Tasas.actualizarReferenciaRapida();
            });
        });

        // Abrir perfil de usuario
        const profileBtn = document.getElementById('user-profile-btn');
        if (profileBtn) {
            profileBtn.addEventListener('click', () => {
                const modal = document.getElementById('auth-modal-overlay');
                if (modal) {
                    modal.style.display = 'flex';
                    modal.offsetHeight;
                    modal.style.opacity = '1';
                }
            });
        }

        const logoutBtn = document.getElementById('auth-logout-btn');
        if (logoutBtn) logoutBtn.addEventListener('click', () => Autenticacion.cerrarSesion());

        // Toggle para cambiar entre Login y Registro
        let esRegistro = false;
        const toggleBtn = document.getElementById('auth-toggle-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', (e) => {
                e.preventDefault();
                esRegistro = !esRegistro;
                const titulo = document.getElementById('auth-title');
                const accionBtn = document.getElementById('auth-action-btn');
                const toggleTexto = document.getElementById('auth-toggle-text');
                const camposRegistro = document.getElementById('auth-register-fields');
                
                if (esRegistro) {
                    titulo.innerText = "Crear Cuenta";
                    accionBtn.innerText = "Regístrate";
                    toggleTexto.innerText = "¿Ya tienes cuenta?";
                    toggleBtn.innerText = "Inicia Sesión";
                    if (camposRegistro) camposRegistro.style.display = 'flex';
                } else {
                    titulo.innerText = "Iniciar Sesión";
                    accionBtn.innerText = "Entrar";
                    toggleTexto.innerText = "¿No tienes cuenta?";
                    toggleBtn.innerText = "Regístrate";
                    if (camposRegistro) camposRegistro.style.display = 'none';
                }
            });
        }

        const formAuth = document.getElementById('auth-form');
        if (formAuth) {
            formAuth.addEventListener('submit', (e) => {
                e.preventDefault();
                const datos = {
                    email: document.getElementById('auth-email').value,
                    password: document.getElementById('auth-password').value,
                    nombre: document.getElementById('auth-firstname')?.value,
                    apellido: document.getElementById('auth-lastname')?.value,
                    fechaNacimiento: document.getElementById('auth-dob')?.value,
                    esRegistro: esRegistro // Capturado por closure
                };
                
                // Llamamos a la función maestra unificada
                Autenticacion.procesarFormulario(datos);
            });
        }

        // Subida de Avatar
        const avatarBtn = document.getElementById('profile-avatar-wrapper');
        const inputArchivo = document.getElementById('avatar-file-input');
        if (avatarBtn && inputArchivo) {
            avatarBtn.addEventListener('click', () => inputArchivo.click());
            inputArchivo.addEventListener('change', (e) => {
                const archivo = e.target.files[0];
                if (archivo) Autenticacion.actualizarAvatar(archivo);
            });
        }

        // Gestión de Cuentas
        const btnCuentas = document.getElementById('open-accounts-btn');
        const overlayCuentas = document.getElementById('accounts-modal-overlay');
        const modalCuentas = document.getElementById('accounts-modal');
        if (btnCuentas && overlayCuentas) {
            btnCuentas.addEventListener('click', () => {
                overlayCuentas.style.display = 'block';
                setTimeout(() => {
                    overlayCuentas.style.opacity = '1';
                    if (modalCuentas) modalCuentas.classList.add('show');
                }, 10);
                Cuentas.cargarCuentas();
            });
        }

        const btnCerrarCuentas = document.getElementById('close-accounts-modal');
        if (btnCerrarCuentas && overlayCuentas) {
            btnCerrarCuentas.addEventListener('click', () => {
                overlayCuentas.style.opacity = '0';
                if (modalCuentas) modalCuentas.classList.remove('show');
                setTimeout(() => { overlayCuentas.style.display = 'none'; }, 300);
            });
        }

        const btnToggleFormCuentas = document.getElementById('add-account-btn');
        const btnCancelarCuenta = document.getElementById('cancel-pm-btn');
        const formNuevaCuenta = document.getElementById('pm-add-form');
        
        if (btnToggleFormCuentas && formNuevaCuenta) {
            btnToggleFormCuentas.addEventListener('click', () => formNuevaCuenta.classList.toggle('show'));
        }
        
        if (btnCancelarCuenta && formNuevaCuenta) {
            btnCancelarCuenta.addEventListener('click', () => formNuevaCuenta.classList.remove('show'));
        }

        const btnGuardarCuenta = document.getElementById('save-pm-btn');
        if (btnGuardarCuenta) {
            btnGuardarCuenta.addEventListener('click', async () => {
                const datos = {
                    banco_nombre: document.getElementById('pm-banco').value,
                    tipo_documento: document.getElementById('pm-id-type').value,
                    numero_documento: document.getElementById('pm-id-num').value,
                    prefijo_tel: document.getElementById('pm-tel-prefix').value,
                    numero_tel: document.getElementById('pm-tel-num').value,
                    etiqueta: document.getElementById('pm-etiqueta').value
                };
                const exito = await Cuentas.guardarCuenta(datos);
                if (exito && formNuevaCuenta) formNuevaCuenta.classList.remove('show');
            });
        }

        // Cerrar Auth Modal
        const closeAuth = document.getElementById('close-auth-modal');
        if (closeAuth) {
            closeAuth.addEventListener('click', () => {
                const modal = document.getElementById('auth-modal-overlay');
                if (modal) {
                    modal.style.opacity = '0';
                    setTimeout(() => { modal.style.display = 'none'; }, 300);
                }
            });
        }

        // Botón de Compartir Tasa Diaria
        const btnCompartirDia = document.getElementById('share-daily-rate-btn');
        if (btnCompartirDia) btnCompartirDia.addEventListener('click', () => Calculadora.generarImagenCompartir());

        // --- BOTONES DEL MODAL DE RECIBO / COMPARTIR ---
        const btnCerrarRecibo = document.getElementById('close-receipt-modal');
        const btnCompartirRecibo = document.getElementById('share-receipt-btn');
        const overlayRecibo = document.getElementById('receipt-modal-overlay');

        if (btnCerrarRecibo && overlayRecibo) {
            btnCerrarRecibo.addEventListener('click', () => {
                overlayRecibo.style.opacity = '0';
                setTimeout(() => { overlayRecibo.style.display = 'none'; }, 300);
            });
        }

        if (btnCompartirRecibo) {
            btnCompartirRecibo.addEventListener('click', () => Principal.compartirImagenGenerada());
        }
        
        // Surtidor de Gasolina
        const sliderGasofa = document.getElementById('pump-slider');
        if (sliderGasofa) sliderGasofa.addEventListener('input', () => Tasas.refrescarSurtidor());
    },

    // --- Navegación Especial y Hub ---
    abrirHub() {
        const hub = document.getElementById('hub-overlay');
        if (hub) {
            // --- Seguridad & Personalización Mi Cartera v4.1 (Polishing) ---
            this.actualizarEstadosHub();

            hub.style.display = 'flex';
            setTimeout(() => {
                hub.classList.add('show');
                if (window.navigator.vibrate) window.navigator.vibrate(20);
            }, 10);
        }
    },

    // Actualiza visualmente el Hub según la sesión (v7.4.7)
    actualizarEstadosHub() {
        const user = window.DolarVE?.usuario;
        const portfolioItem = document.getElementById('hub-item-portfolio');
        const portfolioIcon = document.getElementById('hub-icon-portfolio');
        const portfolioBadge = document.getElementById('hub-badge-portfolio');

        if (portfolioItem && portfolioIcon && portfolioBadge) {
            if (user) {
                // MODO: Autenticado - Mostramos BETA!
                portfolioItem.classList.remove('disabled');
                portfolioBadge.style.display = 'block';
                portfolioBadge.innerText = 'BETA!';
                portfolioBadge.style.background = 'var(--cv-red)';
                portfolioIcon.innerHTML = `<i class="ph-fill ph-wallet"></i>`;
            } else {
                // MODO: Invitado (Requiere sesión)
                portfolioItem.classList.add('disabled');
                portfolioBadge.style.display = 'block';
                portfolioBadge.innerText = 'Inicie Sesión';
                portfolioBadge.style.background = 'rgba(255,255,255,0.08)'; // Estilo original mutado
                portfolioIcon.innerHTML = `<i class="ph-fill ph-lock-key"></i>`;
            }
        }
    },

    cerrarHub() {
        const hub = document.getElementById('hub-overlay');
        if (hub) {
            hub.classList.remove('show');
            setTimeout(() => {
                if (!hub.classList.contains('show')) hub.style.display = 'none';
            }, 400);
        }
    },
    
    navegar(pantalla) {
        // --- Auth Guard para Mi Cartera v4.0.2 ---
        if (pantalla === 'portfolio-screen' && !window.DolarVE?.usuario) {
            this.cerrarHub();
            Interfaz.mostrarNotificacion('⚠️ Debes iniciar sesión para usar Mi Cartera');
            // Abrir modal de auth
            const authModal = document.getElementById('auth-modal-overlay');
            if (authModal) {
                authModal.style.display = 'flex';
                setTimeout(() => authModal.style.opacity = '1', 10);
            }
            return;
        }

        this.cerrarHub();

        // [NUEVO v6.9] Inmersión Total & Loader (Entrada y Salida)
        const entrarCartera = pantalla === 'portfolio-screen';
        const salirCartera = document.body.classList.contains('portfolio-active') && pantalla !== 'portfolio-screen';

        if (entrarCartera || salirCartera) {
            if (window.Cartera) Cartera.mostrarLoader();
            
            setTimeout(async () => {
                if (entrarCartera) {
                    document.body.classList.add('portfolio-active');
                    // Inicializar módulo modular v7.0
                    if (window.Cartera) await Cartera.inicializar();
                } else {
                    document.body.classList.remove('portfolio-active');
                }
                
                Interfaz.cambiarPantalla(pantalla);
                if (pantalla === 'home-screen') this.refrescarComponentesHome();
                
                setTimeout(() => {
                    if (window.Cartera) Cartera.ocultarLoader();
                }, 800);
            }, 600);
            return;
        }

        document.body.classList.remove('portfolio-active');
        Interfaz.cambiarPantalla(pantalla);
        
        // Refrescos dinámicos según pantalla
        if (pantalla === 'home-screen') {
            this.refrescarComponentesHome();
        } else if (pantalla === 'pump-screen') {
            if (window.Tasas) Tasas.obtenerEstacionesCercanas();
        }
    },

    // Asegura que los componentes del Home (Ticker, Pulse) se vean al volver (Optimizado iPhone v3.1)
    refrescarComponentesHome() {
        console.log('[DolarVE] Resurrección de Animaciones Home (Forced v3.1)...');
        
        const resetAnimacion = (elId, animOriginal) => {
            const el = document.getElementById(elId);
            if (!el) return;
            
            // 1. Limpieza total de animación para que el navegador "olvide" el estado anterior
            el.style.animation = 'none';
            el.style.webkitAnimation = 'none';
            
            // 2. Forzamos un reflow profundo (esto es lo que "despierta" al motor CSS)
            void el.offsetWidth;
            
            // 3. Re-inyectamos la animación en el siguiente frame de dibujo
            requestAnimationFrame(() => {
                setTimeout(() => {
                    el.style.animation = animOriginal;
                    el.style.webkitAnimation = animOriginal;
                    // Forzamos visibilidad y aceleración GPU
                    el.style.opacity = '1';
                    el.style.transform = 'translateZ(0)';
                }, 10);
            });
        };

        // Reseteamos el Ticker y el Pulse track independientemente (v7.6.5 Sync)
        resetAnimacion('home-news-ticker', 'ticker-scroll 35s linear infinite');
        resetAnimacion('pulse-track', 'crypto-scroll 45s linear infinite');

        // Además, refrescamos el contenedor general para asegurar visibilidad en iPhone/Safari
        const tickerContainer = document.getElementById('news-ticker-container');
        if (tickerContainer) {
            // Forzamos el reinicio de la animación de entrada (Fade In + Slide Up)
            tickerContainer.style.animation = 'none';
            void tickerContainer.offsetHeight;
            tickerContainer.style.animation = 'slideUpFade 0.8s ease forwards';
            tickerContainer.style.opacity = '1';
        }

        // Reiniciamos el scroll de las noticias de Insight si estaban activas
        this.iniciarAutoScrollNoticias();
    },

    actualizarUISeleccion(activeItem) {
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        if (activeItem) activeItem.classList.add('active');
    },

    // Lógica para que la app sea instalable (PWA Pro)
    inicializarPWA() {
        let deferredPrompt;
        const installBtn = document.getElementById('pwa-install-btn');
        const installText = document.getElementById('install-text');
        const installIcon = document.getElementById('install-icon');
        const installModalOverlay = document.getElementById('install-modal-overlay');
        const installModal = document.getElementById('install-modal');
        const closeInstallModal = document.getElementById('close-install-modal');
        
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

        if (!isStandalone) {
            if (installBtn) installBtn.style.display = 'flex';
            if (isIOS) {
                if (installText) installText.innerText = 'Cómo instalar en iPhone';
                if (installIcon) { 
                    installIcon.className = 'ph-duotone ph-apple-logo'; 
                    installIcon.style.color = '#fff'; 
                }
            } else if (/Android/i.test(navigator.userAgent)) {
                if (installText) installText.innerText = 'Instalar en Android';
                if (installIcon) installIcon.className = 'ph-duotone ph-android-logo';
            }
        }

        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            if (installBtn && !isStandalone) installBtn.style.display = 'flex';
        });

        if (installBtn) {
            installBtn.addEventListener('click', async () => {
                if (window.navigator.vibrate) window.navigator.vibrate(15);
                if (isIOS) {
                    if (installModalOverlay && installModal) {
                        installModalOverlay.style.display = 'block';
                        setTimeout(() => {
                            installModalOverlay.style.opacity = '1';
                            installModal.style.transform = 'translateY(0)';
                        }, 10);
                    }
                } else if (deferredPrompt) {
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    if (outcome === 'accepted') installBtn.style.display = 'none';
                    deferredPrompt = null;
                } else {
                    Interfaz.mostrarNotificacion('💡 Busca el ícono de instalar en tu menú');
                }
            });
        }

        if (closeInstallModal) {
            closeInstallModal.addEventListener('click', () => {
                if (installModalOverlay) {
                    installModalOverlay.style.opacity = '0';
                    if (installModal) installModal.style.transform = 'translateY(100%)';
                    setTimeout(() => { installModalOverlay.style.display = 'none'; }, 300);
                }
            });
        }
    },

    // --- DolarVE Insights & News Logic ---
    async obtenerNoticiasEconomicas() {
        const feedContainer = document.getElementById('news-feed');
        if (!feedContainer) return;

        console.log('[DolarVE] Buscando noticias frescas...');
        
        const fuentes = [
            { url: 'https://www.bancaynegocios.com/feed/', name: 'Banca y Negocios' },
            { url: 'https://www.descifrado.com/feed/', name: 'Descifrado' },
            { url: 'https://finanzasdigital.com/feed/', name: 'Finanzas Digital' }
        ];

        let todasLasNoticias = [];

        for (const fuente of fuentes) {
            try {
                const rssUrl = encodeURIComponent(fuente.url);
                // Usamos un cache-buster t=Date.now()
                const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}&t=${Date.now()}`);
                const data = await response.json();
                
                if (data.status === 'ok' && data.items.length > 0) {
                    // Mapeamos para incluir el nombre de la fuente
                    const itemsConFuente = data.items.slice(0, 4).map(item => ({
                        ...item,
                        fuenteApp: fuente.name
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
            this.poblarNewsFeed(todasLasNoticias);
            this.poblarHomeTicker(todasLasNoticias);
            this.iniciarAutoScrollNoticias();
        } else {
            feedContainer.innerHTML = `
                <div style="padding: 40px 20px; text-align: center; color: var(--text-muted);">
                    <i class="ph-duotone ph-rss-slash" style="font-size: 32px; margin-bottom: 10px; opacity: 0.5;"></i>
                    <p style="font-size: 13px;">No pudimos conectar con las fuentes de noticias. Reintenta más tarde.</p>
                </div>
            `;
        }
    },

    poblarNewsFeed(noticias) {
        const feedContainer = document.getElementById('news-feed');
        if (!feedContainer || !noticias.length) return;

        feedContainer.innerHTML = noticias.slice(0, 8).map(news => {
            const fecha = new Date(news.pubDate).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
            // Limpiar títulos de entidades HTML comunes
            const tituloLimpio = news.title
                .replace(/&quot;/g, '"')
                .replace(/&#8211;/g, '-')
                .replace(/&#8220;/g, '"')
                .replace(/&#8221;/g, '"')
                .replace(/&#8230;/g, '...')
                .replace(/&amp;/g, '&');

            const categoria = news.categories && news.categories.length > 0 ? news.categories[0] : 'ECONOMÍA';
            
            return `
                <div class="news-item-elite" onclick="window.open('${news.link}', '_blank')">
                    <div class="news-pill">${categoria}</div>
                    <div class="news-title-elite">${tituloLimpio}</div>
                    <div class="news-footer">
                        <span class="news-source">${news.fuenteApp}</span>
                        <span class="news-date">${fecha}</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    poblarHomeTicker(noticias) {
        const tickerContainer = document.getElementById('news-ticker-container');
        const tickerContent = document.getElementById('home-news-ticker');
        if (!tickerContainer || !tickerContent || !noticias.length) return;

        // Limpiamos y preparamos el contenido
        // Duplicamos el contenido para que el scroll infinito sea fluido
        const tickerHTML = noticias.slice(0, 5).map(news => {
            const tituloLimpio = news.title
                .replace(/&quot;/g, '"')
                .replace(/&#8220;/g, '"')
                .replace(/&#8221;/g, '"')
                .replace(/&#8230;/g, '...')
                .replace(/&amp;/g, '&');
            
            return `
                <div class="ticker-item" onclick="Principal.navegar('insights-section')">
                    <div class="ticker-dot"></div>
                    ${tituloLimpio}
                </div>
            `;
        }).join('');

        tickerContent.innerHTML = tickerHTML + tickerHTML; // Doble para loop infinito
        tickerContainer.style.display = 'block';
    },

    iniciarAutoScrollNoticias() {
        const feed = document.getElementById('news-feed');
        if (!feed || feed.dataset.scrolling === 'true') return;
        
        feed.dataset.scrolling = 'true';
        let scrollDir = 1;
        
        setInterval(() => {
            if (!document.getElementById('insights-section').classList.contains('active')) return;
            
            const currentScroll = feed.scrollLeft;
            const maxScroll = feed.scrollWidth - feed.clientWidth;
            
            if (currentScroll >= maxScroll - 2) {
                feed.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                feed.scrollBy({ left: 300, behavior: 'smooth' });
            }
        }, 6000);
    },

    generarAnalisisMercado() {
        const cardParent = document.getElementById('daily-insight');
        const titleEl = document.getElementById('insight-title');
        const bodyEl = document.getElementById('insight-body');
        if (!titleEl || !bodyEl || !cardParent) return;

        const bcv = window.DolarVE.tasas.usd || 0;
        const paralelo = window.DolarVE.tasas.paralelo || 0;
        if (bcv <= 0) return;

        const brecha = ((paralelo - bcv) / bcv) * 100;
        let analisis = "";
        let titulo = "Fuerza del Mercado";
        
        // Reset state
        cardParent.classList.remove('alert-high');

        if (brecha > 12) {
            titulo = "⚠️ Brecha Elevada";
            analisis = `La diferencia es del ${brecha.toFixed(2)}%. Se recomienda cautela en transacciones fuera del BCV.`;
            cardParent.classList.add('alert-high'); // Activa el resplandor rojo
        } else if (brecha > 5) {
            titulo = "📊 Mercado Activo";
            analisis = `La brecha se mantiene estable en el ${brecha.toFixed(2)}%. Movimiento regular.`;
        } else {
            titulo = "✅ Mercado Estable";
            analisis = "Las tasas oficial y paralela están en alta convergencia. Escenario ideal.";
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

    // Función Maestra para compartir la imagen actual generada
    async compartirImagenGenerada() {
        if (!window.DolarVE.ultimoRecibo) {
            Interfaz.mostrarNotificacion('⚠️ No hay imagen generada para compartir');
            return;
        }

        try {
            // Convertimos el base64 a un archivo real (Blob)
            const response = await fetch(window.DolarVE.ultimoRecibo);
            const blob = await response.blob();
            const archivo = new File([blob], 'DolarVE-Recibo.png', { type: 'image/png' });

            // Verificar si el equipo soporta compartir archivos (Mobile Pro)
            if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
                await navigator.share({
                    files: [archivo],
                    title: 'DolarVE - Finanzas al Instante',
                    text: 'Compartido desde DolarVE 🚀'
                });
            } else {
                // Fallback: Descarga directa para escritorio o navegadores viejos
                const link = document.createElement('a');
                link.href = window.DolarVE.ultimoRecibo;
                link.download = `DolarVE_${Date.now()}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                Interfaz.mostrarNotificacion('📸 Imagen descargada con éxito');
            }
        } catch (e) {
            console.error('[DolarVE] Error al compartir:', e);
            Interfaz.mostrarNotificacion('❌ Error al intentar compartir');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => Principal.inicializar());
window.Principal = Principal;
