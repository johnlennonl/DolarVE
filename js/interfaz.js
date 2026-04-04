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

    // Lógica para cambiar entre Inicio, Calculadora, Gasolina, etc.
    cambiarPantalla(index) {
        const navItems = document.querySelectorAll('.nav-item');
        const screens = document.querySelectorAll('.screen');
        
        const hacerTransicion = () => {
            navItems.forEach(i => i.classList.remove('active'));
            navItems[index].classList.add('active');
            screens.forEach(s => s.classList.remove('active'));
            screens[index].classList.add('active');

            // Si vamos a la calculadora, refrescamos los números
            if (index === 1 && typeof Calculadora !== 'undefined') {
                Calculadora.actualizarPantalla();
            }
            // Si vamos a gasolina, refrescamos el surtidor
            if (index === 2 && typeof window.refreshPump === 'function') {
                window.refreshPump();
            }
        };

        // Animación suave si el navegador lo permite
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
        navItems.forEach((item, index) => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.cambiarPantalla(index);
            });
        });
    },

    // --- Notificaciones del Sistema (Push) ---
    async inicializarPush() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        
        const registro = await navigator.serviceWorker.ready;
        const suscripcion = await registro.pushManager.getSubscription();
        window.DolarVE.suscritoPush = !!suscripcion;
        this.actualizarIconoCampana();
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
    }
};

// Exportamos al objeto global para que todos lo vean
window.Interfaz = Interfaz;
window.showNotification = (msg) => Interfaz.mostrarNotificacion(msg);
