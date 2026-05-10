// ==========================================
// Módulo de Autenticación y Perfil - DolarVE
// Aquí manejamos todo el brollo de Supabase, login y avatares.
// ==========================================

const Autenticacion = {
    // ¡Chamo! ¿Hay alguien conectado?
    async verificarSesion() {
        const { data: { session } } = await window.DolarVE.supabase.auth.getSession();
        this.actualizarInterfazUsuario(session?.user || null);
    },

    // Configura los eventos de cambio de sesión (entrar/salir)
    inicializarEscuchaSesion() {
        window.DolarVE.supabase.auth.onAuthStateChange((event, session) => {
            console.log('[DolarVE] Evento de sesión:', event, !!session);
            this.actualizarInterfazUsuario(session?.user || null);
            
            // Si el pana entró, cargamos sus cuentas y su CARTERA CUSTOM
            setTimeout(() => { 
                if (typeof Cuentas !== 'undefined') Cuentas.cargarCuentas(); 
                if (typeof Cartera !== 'undefined' && session?.user) Cartera.cargarDesdeSupabase();
            }, 500);
        });
    },

    // Actualiza la fotico y el nombre en toda la app
    actualizarInterfazUsuario(user) {
        window.DolarVE.usuario = user;
        const shortName = document.getElementById('user-short-name');
        const avatarImg = document.getElementById('user-avatar-img');
        const avatarPlaceholder = document.getElementById('user-avatar-placeholder');
        const loginView = document.getElementById('auth-login-view');
        const profileView = document.getElementById('auth-profile-view');

        if (user) {
            const meta = user.user_metadata || {};
            const fName = meta.first_name || '';
            const lName = meta.last_name || '';
            const avatarUrl = meta.avatar_url || '';
            const dob = meta.dob || '';

            if (shortName) shortName.innerText = fName || 'Perfil';

            // Actualizamos fotos del header
            if (avatarImg && avatarPlaceholder) {
                if (avatarUrl) {
                    avatarImg.src = avatarUrl;
                    avatarImg.style.display = 'block';
                    avatarPlaceholder.style.display = 'none';
                } else {
                    avatarImg.style.display = 'none';
                    avatarPlaceholder.style.display = 'block';
                }
            }

            // Cambiamos vista del modal a Perfil
            if (loginView) loginView.style.display = 'none';
            if (profileView) profileView.style.display = 'block';

            // Llenamos la ficha del perfil
            document.getElementById('profile-display-name').innerText = `${fName} ${lName}`.trim() || 'Usuario';
            document.getElementById('profile-display-email').innerText = user.email;
            document.getElementById('profile-dob').innerText = dob ? new Date(dob).toLocaleDateString('es-VE', { day: 'numeric', month: 'long', year: 'numeric' }) : 'No definida';
            document.getElementById('profile-created').innerText = new Date(user.created_at).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' });

            const profAvatarImg = document.getElementById('profile-avatar-img');
            const profAvatarPlaceholder = document.getElementById('profile-avatar-placeholder');
            if (profAvatarImg && profAvatarPlaceholder) {
                if (avatarUrl) {
                    profAvatarImg.src = avatarUrl;
                    profAvatarImg.style.display = 'block';
                    profAvatarPlaceholder.style.display = 'none';
                } else {
                    profAvatarImg.style.display = 'none';
                    profAvatarPlaceholder.style.display = 'flex';
                }
            }
        } else {
            // No hay nadie, mostramos "Ingresar"
            if (shortName) shortName.innerText = 'Ingresar';
            if (avatarImg) avatarImg.style.display = 'none';
            if (avatarPlaceholder) avatarPlaceholder.style.display = 'block';
            if (loginView) loginView.style.display = 'block';
            if (profileView) profileView.style.display = 'none';
        }

        // Sincronizar estados del Hub (Bloqueo/Habilitación de Mi Cartera)
        if (window.Principal && Principal.actualizarEstadosHub) {
            Principal.actualizarEstadosHub();
        }
    },

    // Subida de foto pal' Supabase Storage
    async actualizarAvatar(file) {
        if (!file || !window.DolarVE.usuario) return;
        
        Interfaz.mostrarNotificacion('Subiendo foto...');
        const user = window.DolarVE.usuario;
        const fileExt = file.name.split('.').pop();
        const filePath = `avatars/${user.id}.${fileExt}`;

        try {
            const { error: uploadError } = await window.DolarVE.supabase.storage
                .from('avatars')
                .upload(filePath, file, { upsert: true, contentType: file.type });

            if (uploadError) throw uploadError;

            const { data: urlData } = window.DolarVE.supabase.storage.from('avatars').getPublicUrl(filePath);
            const publicURL = urlData.publicUrl + '?t=' + Date.now();

            await window.DolarVE.supabase.auth.updateUser({
                data: { avatar_url: publicURL }
            });

            Interfaz.mostrarNotificacion('¡Foto actualizada! 📸');
        } catch (err) {
            console.error('[DolarVE] Error subiendo avatar:', err);
            Interfaz.mostrarNotificacion('Error: ' + err.message);
        }
    },

    // Función para chao sesión
    async cerrarSesion() {
        const { error } = await window.DolarVE.supabase.auth.signOut();
        if (error) {
            Interfaz.mostrarNotificacion('Error al salir: ' + error.message);
        } else {
            Interfaz.mostrarNotificacion('Sesión cerrada. Limpiando datos...');
            
            // Seguridad v7.4.9: Limpiar todo rastro local para evitar filtraciones entre cuentas
            localStorage.removeItem('dolarve_cartera_v4');
            localStorage.removeItem('sb-ntuivcufqswvlytyvszq-auth-token'); // Limpiar token de Supabase explícitamente si es necesario
            
            // Forzar recarga completa para purgar memoria JS
            setTimeout(() => {
                location.href = 'index.html'; 
            }, 1000);
        }
    },

    async procesarFormulario(datos) {
        const { email, password, nombre, apellido, fechaNacimiento, esRegistro } = datos;
        const authBtn = document.getElementById('auth-action-btn');
        const authBtnText = document.getElementById('auth-action-text');
        const originalText = authBtnText ? authBtnText.innerText : (esRegistro ? 'Regístrate' : 'Entrar');

        if (authBtn) {
            authBtn.disabled = true;
            authBtn.style.opacity = '0.7';
            if (authBtnText) {
                authBtnText.innerHTML = '<i class="ph-duotone ph-circle-notch ph-spinning"></i> Cargando...';
            }
        }

        try {
            if (esRegistro) {
                const { data, error } = await window.DolarVE.supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            first_name: nombre,
                            last_name: apellido,
                            dob: fechaNacimiento
                        }
                    }
                });
                if (error) throw error;

                if (data.session) {
                    Interfaz.mostrarNotificacion('¡Bienvenido! Registro exitoso.');
                    document.getElementById('close-auth-modal').click();
                } else {
                    // Mostrar vista de verificación
                    const loginView = document.getElementById('auth-login-view');
                    const verifyView = document.getElementById('auth-verify-view');
                    if (loginView && verifyView) {
                        loginView.style.display = 'none';
                        verifyView.style.display = 'block';
                    } else {
                        Interfaz.mostrarNotificacion('¡Registro exitoso! Revisa tu correo.');
                    }
                }
            } else {
                const { data, error } = await window.DolarVE.supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                Interfaz.mostrarNotificacion('¡Qué bueno verte de nuevo!');
                document.getElementById('close-auth-modal').click();
            }
        } catch (err) {
            console.error('[DolarVE] Error de Auth:', err);
            Interfaz.mostrarNotificacion('Error: ' + err.message);
        } finally {
            if (authBtn) {
                authBtn.disabled = false;
                authBtn.style.opacity = '1';
                if (authBtnText) {
                    authBtnText.innerHTML = originalText;
                }
            }
        }
    },

    // Actualiza los datos básicos del perfil (v7.7.5)
    async actualizarPerfil(datos) {
        const { nombre, apellido, fechaNacimiento } = datos;
        const saveBtn = document.getElementById('save-profile-btn');
        const loading = document.getElementById('edit-loading');

        if (saveBtn) saveBtn.style.display = 'none';
        if (loading) loading.style.display = 'flex';

        try {
            const { data, error } = await window.DolarVE.supabase.auth.updateUser({
                data: {
                    first_name: nombre,
                    last_name: apellido,
                    dob: fechaNacimiento
                }
            });

            if (error) throw error;

            Interfaz.mostrarNotificacion('✅ ¡Perfil actualizado correctamente!');
            
            // Regresamos a la vista de perfil
            document.getElementById('auth-edit-view').style.display = 'none';
            document.getElementById('auth-profile-view').style.display = 'block';
            
            // Refrescamos la UI con los nuevos datos
            this.actualizarInterfazUsuario(data.user);

        } catch (err) {
            console.error('[DolarVE] Error actualizando perfil:', err);
            Interfaz.mostrarNotificacion('❌ Error: ' + err.message);
        } finally {
            if (saveBtn) saveBtn.style.display = 'block';
            if (loading) loading.style.display = 'none';
        }
    }
};

window.Autenticacion = Autenticacion;
