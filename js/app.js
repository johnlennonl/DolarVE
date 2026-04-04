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

        // 3. Activamos la navegación y botones principales
        Interfaz.inicializarNavegacion();
        this.configurarBotonesInterfaz();

        // 4. Chequeamos quién está logueado en Supabase
        if (window.DolarVE.supabase) {
            await Autenticacion.verificarSesion();
            Autenticacion.inicializarEscuchaSesion();
        }

        // 5. ¡A buscar los reales! Traemos las tasas de una vez
        await Tasas.obtenerDatosTasas();
        
        // 6. Iniciamos el Surtidor y la Referencia rápida
        Tasas.refrescarSurtidor();
        Tasas.actualizarReferenciaRapida();

        // 7. Ponemos a valer las notificaciones y cookies
        Interfaz.inicializarPush();
        Interfaz.verificarCookies();
        
        // 8. PWA e Instalación
        this.inicializarPWA();
        Interfaz.verificarAnuncioActualizacion();

        // 9. Noticias y Análisis (DolarVE Insights)
        this.obtenerNoticiasEconomicas();
        this.generarAnalisisMercado();
        
        // 9. Actualización Automática (Tiempo Real) - Cada 5 minutos
        setInterval(() => {
            console.log('[DolarVE] Actualización periódica en curso...');
            Tasas.obtenerDatosTasas();
        }, 300000);
        
        // 10. Cableado de eventos legales
        this.configurarEventosLegales();
        const btnCerrarCripto = document.getElementById('close-crypto-modal');
        const overlayCripto = document.getElementById('crypto-modal-overlay');
        if (btnCerrarCripto && overlayCripto) {
            const cerrar = () => {
                overlayCripto.style.opacity = '0';
                const modal = document.getElementById('crypto-modal');
                if (modal) modal.style.transform = 'translateY(100%)';
                setTimeout(() => { overlayCripto.style.display = 'none'; }, 300);
            };
            btnCerrarCripto.addEventListener('click', cerrar);
            overlayCripto.addEventListener('click', (e) => {
                if (e.target === overlayCripto) cerrar();
            });
        }
    },

    // Configura lo relacionado a Cookies y Términos
    configurarEventosLegales() {
        const btnAceptar = document.getElementById('accept-cookies-btn');
        if (btnAceptar) btnAceptar.addEventListener('click', () => Interfaz.aceptarCookies());

        // Botón de Términos (desde ajustes o cookies)
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
            // El toggle está dentro de un contenedor, mejor escuchar ahí o en el switch
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
                // Si el usuario no tiene cuentas, le avisamos
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
                    // Actualizar UI del chip activo en comisiones
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

        // Botón para salir (Logout)
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

        // Formulario de Auth (Submit)
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
                    esRegistro: esRegistro
                };
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

        // Gestión de Cuentas (Abrir/Cerrar/Agregar)
        const btnCuentas = document.getElementById('open-accounts-btn');
        const overlayCuentas = document.getElementById('accounts-modal-overlay');
        const modalCuentas = document.getElementById('accounts-modal');
        if (btnCuentas) {
            btnCuentas.addEventListener('click', () => {
                overlayCuentas.style.display = 'block';
                setTimeout(() => {
                    overlayCuentas.style.opacity = '1';
                    modalCuentas.classList.add('show');
                }, 10);
                Cuentas.cargarCuentas();
            });
        }

        const btnCerrarCuentas = document.getElementById('close-accounts-modal');
        if (btnCerrarCuentas) {
            btnCerrarCuentas.addEventListener('click', () => {
                overlayCuentas.style.opacity = '0';
                setTimeout(() => { overlayCuentas.style.display = 'none'; }, 300);
            });
        }

        const btnToggleFormCuentas = document.getElementById('add-account-btn');
        const formNuevaCuenta = document.getElementById('pm-add-form');
        const btnCancelarCuenta = document.getElementById('cancel-pm-btn');

        if (btnToggleFormCuentas && formNuevaCuenta) {
            btnToggleFormCuentas.addEventListener('click', () => {
                formNuevaCuenta.classList.toggle('show');
            });
        }

        if (btnCancelarCuenta && formNuevaCuenta) {
            btnCancelarCuenta.addEventListener('click', () => {
                formNuevaCuenta.classList.remove('show');
            });
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
                if (exito) formNuevaCuenta.style.display = 'none';
            });
        }

        // Cerrar Auth Modal
        const closeAuth = document.getElementById('close-auth-modal');
        if (closeAuth) {
            closeAuth.addEventListener('click', () => {
                const modal = document.getElementById('auth-modal-overlay');
                modal.style.opacity = '0';
                setTimeout(() => { modal.style.display = 'none'; }, 300);
            });
        }

        // Cerrar Modal Cripto (X)
        const closeCrypto = document.getElementById('close-crypto-modal');
        if (closeCrypto) {
            closeCrypto.addEventListener('click', () => {
                const overlay = document.getElementById('crypto-modal-overlay');
                const modal = document.getElementById('crypto-modal');
                if (overlay && modal) {
                    overlay.style.opacity = '0';
                    modal.style.transform = 'translateY(100%)';
                    setTimeout(() => { overlay.style.display = 'none'; }, 300);
                }
            });
        }

        // Botón de Compartir Tasa Diaria
        const btnCompartirDia = document.getElementById('share-daily-rate-btn');
        if (btnCompartirDia) {
            btnCompartirDia.addEventListener('click', () => {
                Calculadora.generarImagenCompartir();
            });
        }
        
        // Botones de compartir de los modales de imagen
        const btnShareReceipt = document.getElementById('share-receipt-btn');
        if (btnShareReceipt) {
            btnShareReceipt.addEventListener('click', async () => {
                const imgData = window.DolarVE.ultimoRecibo;
                if (!imgData) return;
                
                try {
                    const blob = await (await fetch(imgData)).blob();
                    const file = new File([blob], 'dolarve_recibo.png', { type: 'image/png' });
                    if (navigator.share) {
                        navigator.share({ files: [file], title: 'DolarVE Recibo' });
                    } else {
                        const link = document.createElement('a');
                        link.href = imgData;
                        link.download = 'dolarve_recibo.png';
                        link.click();
                    }
                } catch (e) { console.error(e); }
            });
        }

        const closeReceipt = document.getElementById('close-receipt-modal');
        if (closeReceipt) {
            closeReceipt.addEventListener('click', () => {
                const overlay = document.getElementById('receipt-modal-overlay');
                if (overlay) {
                    overlay.style.opacity = '0';
                    setTimeout(() => { overlay.style.display = 'none'; }, 300);
                }
            });
        }

        // Surtidor de Gasolina
        const sliderGasofa = document.getElementById('pump-slider');
        if (sliderGasofa) {
            sliderGasofa.addEventListener('input', () => {
                Tasas.refrescarSurtidor();
            });
        }
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

        // Ocultar si ya está instalada, si no, configurar según SO
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
                    // Mostrar guía para iPhone
                    if (installModalOverlay && installModal) {
                        installModalOverlay.style.display = 'block';
                        setTimeout(() => {
                            installModalOverlay.style.opacity = '1';
                            installModal.style.transform = 'translateY(0)';
                        }, 10);
                    }
                } else if (deferredPrompt) {
                    // Flujo nativo Android/Chrome
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

        const fuentes = [
            'https://www.bancaynegocios.com/feed/',
            'https://www.descifrado.com/feed/',
            'https://finanzasdigital.com/feed/'
        ];

        for (const url of fuentes) {
            try {
                const rssUrl = encodeURIComponent(url);
                const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${rssUrl}&t=${Date.now()}`);
                const data = await response.json();

                if (data.status === 'ok' && data.items.length > 0) {
                    this.poblarNewsFeed(data.items, url.includes('bancaynegocios') ? 'Banca y Negocios' : 'Economía');
                    this.iniciarAutoScrollNoticias();
                    return; // Si funciona una, paramos
                }
            } catch (e) {
                console.warn(`[DolarVE] Error con fuente ${url}:`, e);
            }
        }

        feedContainer.innerHTML = '<p style="font-size:12px; color:var(--text-muted); padding:10px;">Contenido temporalmente no disponible. Intenta más tarde.</p>';
    },

    poblarNewsFeed(noticias, fuenteNombre) {
        const feedContainer = document.getElementById('news-feed');
        if (!feedContainer || !noticias.length) return;

        feedContainer.innerHTML = noticias.slice(0, 6).map(news => {
            const fecha = new Date(news.pubDate).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
            // Limpiar el título de caracteres raros HTML si vienen
            const tituloLimpio = news.title.replace(/&quot;/g, '"').replace(/&#8230;/g, '...');
            
            return `
                <div class="news-item" onclick="window.open('${news.link}', '_blank')">
                    <div class="news-tag">${news.categories[0] || 'Economía'}</div>
                    <div class="news-title">${tituloLimpio}</div>
                    <div class="news-meta">
                        <span><i class="ph ph-clock"></i> ${fecha}</span>
                        <span>${fuenteNombre}</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    iniciarAutoScrollNoticias() {
        const feed = document.getElementById('news-feed');
        if (!feed) return;

        let interval;
        let isPaused = false;

        const startScrolling = () => {
            interval = setInterval(() => {
                if (isPaused) return;

                const cardWidth = 280 + 15; // Ancho noticia + gap
                const currentScroll = feed.scrollLeft;
                const maxScroll = feed.scrollWidth - feed.clientWidth;

                if (currentScroll >= maxScroll - 5) {
                    feed.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    feed.scrollBy({ left: cardWidth, behavior: 'smooth' });
                }
            }, 5000); // 5 segundos
        };

        feed.addEventListener('mouseenter', () => isPaused = true);
        feed.addEventListener('mouseleave', () => isPaused = false);
        feed.addEventListener('touchstart', () => isPaused = true);
        feed.addEventListener('touchend', () => {
            setTimeout(() => isPaused = false, 2000);
        });

        startScrolling();
    },

    generarAnalisisMercado() {
        const titleEl = document.getElementById('insight-title');
        const bodyEl = document.getElementById('insight-body');
        if (!titleEl || !bodyEl) return;

        setTimeout(() => {
            const bcv = window.DolarVE.tasas.bcv || 0;
            const paralelo = window.DolarVE.tasas.paralelo || 0;

            if (bcv <= 0) {
                bodyEl.innerText = "Esperando actualización de tasas oficiales...";
                return;
            }

            const brecha = ((paralelo - bcv) / bcv) * 100;

            let analisis = "";
            let titulo = "Análisis de Mercado";

            if (brecha > 15) {
                titulo = "⚠️ Brecha Elevada";
                analisis = `La diferencia entre el oficial y el paralelo supera el ${brecha.toFixed(1)}%. Se recomienda cautela en fijación de precios en Bs.`;
            } else if (brecha > 5) {
                titulo = "📊 Mercado Activo";
                analisis = `La brecha se mantiene estable en ${brecha.toFixed(1)}%. Los comercios están ajustando inventarios según la tasa promedio.`;
            } else {
                titulo = "✅ Mercado Estable";
                analisis = "Las tasas oficial y paralela están muy cerca una de la otra. Es un buen momento para transacciones bancarias nacionales.";
            }

            titleEl.innerText = titulo;
            bodyEl.innerText = analisis;

            // Actualizamos los nuevos indicadores de Riesgo y Fuerza
            this.actualizarIndicadoresMercado(brecha);
        }, 3000); // Esperamos a que las tasas carguen
    },

    actualizarIndicadoresMercado(brecha) {
        const volatilityTag = document.getElementById('market-volatility-tag');
        const strengthVal = document.getElementById('market-strength-val');
        const strengthFill = document.getElementById('market-strength-fill');

        if (!volatilityTag || !strengthVal || !strengthFill) return;

        let riesgo = "ESTABLE";
        let colorRiesgo = "var(--accent-green)";
        let iconRiesgo = "ph-shield-check";

        if (brecha > 12) {
            riesgo = "ALERTA";
            colorRiesgo = "var(--accent-red)";
            iconRiesgo = "ph-warning-octagon";
        } else if (brecha > 6) {
            riesgo = "CALIENTE";
            colorRiesgo = "var(--accent-orange)";
            iconRiesgo = "ph-flame";
        }

        volatilityTag.innerHTML = `<i class="ph-duotone ${iconRiesgo}"></i> ${riesgo}`;
        volatilityTag.style.color = colorRiesgo;

        // Fuerza del Bolívar (Inversa a la brecha, simulando confianza)
        const fuerza = Math.max(100 - (brecha * 2.5), 10);
        strengthVal.innerText = `${fuerza.toFixed(0)}%`;
        strengthVal.style.color = fuerza > 70 ? 'var(--accent-green)' : (fuerza > 40 ? 'var(--accent-orange)' : 'var(--accent-red)');
        strengthFill.style.width = `${fuerza}%`;
        strengthFill.style.backgroundColor = strengthVal.style.color;
    }
};

// Evento que dispara todo el brollo
document.addEventListener('DOMContentLoaded', () => {
    Principal.inicializar();
});

window.Principal = Principal;
