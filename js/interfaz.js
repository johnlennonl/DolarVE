// ==========================================
// Módulo de Interfaz y UI - DolarVE
// Aquí manejamos todo lo que el usuario ve y toca:
// Pantallas, Notificaciones, Modo Oscuro y Splash.
// ==========================================

const Interfaz = {
    
    // ¡Epa! Esta es la función para sacar los mensajitos (Toasts)
    mostrarNotificacion(mensaje) {
        const toast = document.getElementById('app-toast');
        const msgEl = document.getElementById('toast-message');
        if (!toast || !msgEl) return;
        
        msgEl.innerText = mensaje;
        toast.classList.add('show');
        
        // Si el teléfono tiene motor de vibración, le pegamos un toquecito
        if (window.navigator.vibrate) window.navigator.vibrate(50);
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    },

    // Para quitar la pantalla de carga (Splash) cuando todo esté listo
    ocultarSplashScreen() {
        const splash = document.getElementById('splash-screen');
        if (splash) splash.classList.add('hidden');
    },

    // Lógica para cambiar entre Inicio, Calculadora, Gasolina, etc. (Usando IDs)
    cambiarPantalla(screenId) {
        const navItems = document.querySelectorAll('.nav-item');
        const screens = document.querySelectorAll('.screen');
        const targetScreen = document.getElementById(screenId);

        if (!targetScreen) {
            console.error(`[DolarVE] Pantalla no encontrada: ${screenId}`);
            return;
        }
        
        const hacerTransicion = () => {
            // Desactivar todo
            navItems.forEach(i => i.classList.remove('active'));
            screens.forEach(s => s.classList.remove('active'));

            // Activar pantalla
            targetScreen.classList.add('active');

            // Iluminar el icono correcto en el nav
            const activeNavItem = document.querySelector(`.nav-item[data-screen="${screenId}"]`);
            if (activeNavItem) activeNavItem.classList.add('active');

            // Refrescos específicos
            if (screenId === 'calc-screen' && typeof Calculadora !== 'undefined') {
                Calculadora.actualizarPantalla();
            }
            if (screenId === 'pump-screen' && typeof window.refreshPump === 'function') {
                window.refreshPump();
            }

            window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        if (document.startViewTransition) {
            document.startViewTransition(hacerTransicion);
        } else {
            hacerTransicion();
        }
    },

    // Alternar entre el lado oscuro y el lado de la luz
    alternarModoOscuro() {
        const themeToggle = document.getElementById('theme-toggle');
        if (!themeToggle) return;
        
        themeToggle.classList.toggle('on');
        document.body.classList.toggle('light-theme');
        
        const esClaro = document.body.classList.contains('light-theme');
        localStorage.setItem('dolarve_theme', esClaro ? 'light' : 'dark');
        
        if (window.navigator.vibrate) window.navigator.vibrate(10);
    },

    // Cargar el tema que el usuario dejó la última vez
    cargarTemaGuardado() {
        const savedTheme = localStorage.getItem('dolarve_theme');
        const themeToggle = document.getElementById('theme-toggle');
        if (savedTheme === 'light') {
            document.body.classList.add('light-theme');
            if (themeToggle) themeToggle.classList.remove('on');
        }
    },

    // Inicializar los clicks de la navegación inferior
    inicializarNavegacion() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach((item) => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const screenId = item.getAttribute('data-screen');
                if (screenId) {
                    this.cambiarPantalla(screenId);
                }
            });
        });
    },

    // --- Notificaciones del Sistema (Push) ---
    VAPID_PUBLIC_KEY: 'BHSKdlZDseu4vvh53xG6BucMXIQ3YFqAu3Y46-we5r3rEIpBoRyeEQYzwwPffAzBZ2VZ2yAgHIQwBCKBntU78iE',

    async inicializarPush() {
        if (!('serviceWorker' in navigator)) {
            console.warn('[DolarVE] Service Worker no soportado');
            this.mostrarNotificacion('⚠️ Tu navegador no soporta notificaciones push');
            return;
        }
        if (!('PushManager' in window)) {
            console.warn('[DolarVE] Push API no soportada');
            this.mostrarNotificacion('⚠️ Tu navegador no soporta notificaciones push');
            return;
        }
        
        try {
            console.log('[DolarVE] 🔔 Inicializando Push...');
            
            // Registrar o recuperar el SW
            const reg = await navigator.serviceWorker.register('/sw.js');
            console.log('[DolarVE] SW registrado. Estado:', reg.active ? 'activo' : reg.installing ? 'instalando' : 'esperando');

            // Obtener el worker (activo, esperando, o instalando)
            let sw = reg.active || reg.waiting || reg.installing;
            
            // Si no está activo, esperar a que lo esté
            if (sw && sw.state !== 'activated') {
                console.log('[DolarVE] Esperando activación del SW (estado actual:', sw.state + ')...');
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        // Intentar usar el registro de todas formas
                        resolve();
                    }, 10000);
                    
                    sw.addEventListener('statechange', () => {
                        console.log('[DolarVE] SW estado cambió a:', sw.state);
                        if (sw.state === 'activated') {
                            clearTimeout(timeout);
                            resolve();
                        }
                    });
                    
                    // Si ya está activo (por skipWaiting)
                    if (sw.state === 'activated') {
                        clearTimeout(timeout);
                        resolve();
                    }
                });
            }

            window.DolarVE.swRegistration = reg;
            const suscripcion = await reg.pushManager.getSubscription();
            window.DolarVE.suscritoPush = !!suscripcion;
            this.actualizarIconoCampana();
            console.log('[DolarVE] ✅ Push inicializado. Suscrito:', !!suscripcion);
        } catch (e) {
            console.error('[DolarVE] Error al inicializar Push:', e);
            this.mostrarNotificacion('⚠️ Error inicializando notificaciones: ' + e.message);
        }
    },

    async alternarSuscripcion() {
        console.log('[DolarVE] 🔔 Campana presionada...');
        this.mostrarNotificacion('🔄 Configurando alertas...');

        try {
            // Paso 1: Asegurar que el SW esté listo
            if (!window.DolarVE.swRegistration) {
                await this.inicializarPush();
            }

            if (!window.DolarVE.swRegistration) {
                this.mostrarNotificacion('⚠️ Error: El servicio de notificaciones no está disponible. Recarga la página.');
                return;
            }

            // Paso 2: Verificar permisos
            if (Notification.permission === 'denied') {
                this.mostrarNotificacion('⚠️ Permiso denegado: Actívalo en los ajustes de tu navegador');
                return;
            }

            // Paso 3: Check iOS (requiere PWA instalada)
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
            if (isIOS && !isStandalone) {
                this.mostrarNotificacion('📲 Instala DolarVE desde Safari → Compartir → Agregar a Pantalla de inicio');
                return;
            }

            // Paso 4: Alternar suscripción
            if (window.DolarVE.suscritoPush) {
                await this.desuscribirUsuario();
            } else {
                await this.suscribirUsuario();
            }
        } catch (err) {
            console.error('[DolarVE] Error en alternarSuscripcion:', err);
            this.mostrarNotificacion('❌ Error: ' + (err.message || 'No se pudo configurar'));
        }
    },

    // Genera o recupera un ID único para este dispositivo (para push sin login)
    getDeviceId() {
        let deviceId = localStorage.getItem('dolarve_device_id');
        if (!deviceId) {
            deviceId = 'device_' + crypto.randomUUID();
            localStorage.setItem('dolarve_device_id', deviceId);
        }
        return deviceId;
    },

    async suscribirUsuario() {
        const registro = window.DolarVE.swRegistration;
        if (!registro) return;

        try {
            const applicationServerKey = this.urlBase64ToUint8Array(this.VAPID_PUBLIC_KEY);
            const suscripcion = await registro.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: applicationServerKey
            });

            console.log('[DolarVE] Usuario suscrito:', JSON.stringify(suscripcion));

            // Guardar en Supabase (funciona con o sin login)
            if (window.DolarVE.supabase) {
                try {
                    const usuario = window.DolarVE.usuario;
                    const deviceId = this.getDeviceId();
                    
                    const payload = {
                        subscription: suscripcion,
                        platform: 'pwa',
                        device_id: deviceId,
                        updated_at: new Date().toISOString()
                    };
                    
                    // Si está logueado, asociar al user_id
                    if (usuario) payload.user_id = usuario.id;

                    // Upsert por device_id para evitar duplicados
                    const { error } = await window.DolarVE.supabase
                        .from('push_subscriptions')
                        .upsert(payload, { onConflict: 'device_id' });
                    
                    if (error) throw error;
                    console.log('[DolarVE] ✅ Suscripción guardada en Supabase');
                } catch (e) { 
                    console.error('[DolarVE] Error guardando suscripción:', e); 
                }
            }

            window.DolarVE.suscritoPush = true;
            this.actualizarIconoCampana();
            this.mostrarNotificacion('✅ ¡Listo! Recibirás alertas de precios en este equipo');

            // Notificación de bienvenida
            setTimeout(() => {
                registro.showNotification('DolarVE 🔔', {
                    body: '¡Ya estás listo para recibir alertas en tiempo real!',
                    icon: '/logo.png',
                    badge: '/logo.png'
                });
            }, 1000);

        } catch (err) {
            console.error('[DolarVE] Error al suscribir:', err);
            if (err.name === 'NotAllowedError') {
                this.mostrarNotificacion('⚠️ Permiso denegado por el navegador');
            } else {
                this.mostrarNotificacion('⚠️ Error al activar alertas');
            }
        }
    },

    async desuscribirUsuario() {
        const registro = window.DolarVE.swRegistration;
        if (!registro) return;

        try {
            const suscripcion = await registro.pushManager.getSubscription();
            if (suscripcion) {
                await suscripcion.unsubscribe();
                
                // Borrar de Supabase por device_id
                if (window.DolarVE.supabase) {
                    const deviceId = this.getDeviceId();
                    await window.DolarVE.supabase.from('push_subscriptions')
                        .delete()
                        .eq('device_id', deviceId);
                }
            }
            
            window.DolarVE.suscritoPush = false;
            this.actualizarIconoCampana();
            this.mostrarNotificacion('🔕 Notificaciones desactivadas');
        } catch (err) {
            console.error('[DolarVE] Error al desuscribir:', err);
        }
    },

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    },

    actualizarIconoCampana() {
        const campana = document.getElementById('push-bell-icon');
        const punto = document.getElementById('push-bell-dot');
        const switchNotif = document.getElementById('push-notifications-toggle');
        
        if (!campana) return;

        if (window.DolarVE.suscritoPush) {
            campana.style.color = 'var(--accent-green)';
            if (punto) punto.style.display = 'none';
            if (switchNotif) switchNotif.classList.add('on');
        } else {
            campana.style.color = 'var(--text-muted)';
            if (punto) punto.style.display = 'block';
            if (switchNotif) switchNotif.classList.remove('on');
        }
    },

    // --- Banner de Cookies y Términos ---
    verificarCookies() {
        const aceptadas = localStorage.getItem('dolarve_cookies_accepted');
        const banner = document.getElementById('cookies-banner');
        
        if (!aceptadas && banner) {
            setTimeout(() => {
                banner.style.display = 'block';
                setTimeout(() => { banner.style.transform = 'translateY(0)'; }, 100);
            }, 3000);
        }
    },

    aceptarCookies() {
        localStorage.setItem('dolarve_cookies_accepted', 'true');
        const banner = document.getElementById('cookies-banner');
        if (banner) {
            banner.style.transform = 'translateY(150%)';
            setTimeout(() => { banner.style.display = 'none'; }, 600);
        }
        this.mostrarNotificacion('¡Listo! Preferencias guardadas. 🍪');
    },

    abrirTerminos() {
        const overlay = document.getElementById('terms-modal-overlay');
        const modal = document.getElementById('terms-modal');
        if (overlay && modal) {
            overlay.style.display = 'block';
            setTimeout(() => {
                overlay.style.opacity = '1';
                modal.style.transform = 'scale(1)';
            }, 10);
        }
    },

    cerrarTerminos() {
        const overlay = document.getElementById('terms-modal-overlay');
        const modal = document.getElementById('terms-modal');
        if (overlay && modal) {
            overlay.style.opacity = '0';
            modal.style.transform = 'scale(0.9)';
            setTimeout(() => { overlay.style.display = 'none'; }, 300);
        }
    },

    // --- Control de Anuncio de Actualización (v7.7.1) ---
    PRO_VERSION: '7.7.1',

    verificarAnuncioActualizacion() {
        const ultimaVersionVista = localStorage.getItem('dolarve_last_version_seen');
        const overlay = document.getElementById('update-modal-overlay');
        const modal = document.getElementById('update-modal');
        const btnCerrar = document.getElementById('close-update-btn');

        if (ultimaVersionVista !== this.PRO_VERSION) {
            // Mostrar anuncio después de que el splash y los datos iniciales carguen
            setTimeout(() => {
                if (overlay && modal) {
                    overlay.style.display = 'block';
                    setTimeout(() => {
                        overlay.style.opacity = '1';
                        modal.classList.add('show');
                    }, 100);
                }
            }, 3500); // 3.5s después de iniciar (post-splash)
        }

        if (btnCerrar) {
            btnCerrar.addEventListener('click', () => {
                localStorage.setItem('dolarve_last_version_seen', this.PRO_VERSION);
                if (overlay && modal) {
                    modal.classList.remove('show');
                    overlay.style.opacity = '0';
                    setTimeout(() => { overlay.style.display = 'none'; }, 500);
                }
                if (window.navigator.vibrate) window.navigator.vibrate(20);
            });
        }
    }
};

// Exportamos al objeto global para que todos lo vean
window.Interfaz = Interfaz;
window.showNotification = (msg) => Interfaz.mostrarNotificacion(msg);
