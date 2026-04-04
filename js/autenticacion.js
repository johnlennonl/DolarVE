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
            console.log('[DolarVE] Evento de sesión:', event);
            this.actualizarInterfazUsuario(session?.user || null);
            
            // Si el pana entró, cargamos sus cuentas de pago móvil
            setTimeout(() => { 
                if (typeof Cuentas !== 'undefined') Cuentas.cargarCuentas(); 
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
        if (error) Interfaz.mostrarNotificacion('Error al salir: ' + error.message);
        else {
            Interfaz.mostrarNotificacion('Sesión cerrada, vuelve pronto chamo.');
        }
    },

    // Función para manejar el envío del formulario (Entrar o Registrarse)
    async procesarFormulario(datos) {
        const { email, password, nombre, apellido, fechaNacimiento, esRegistro } = datos;
        const authBtn = document.getElementById('auth-action-btn');
        const loading = document.getElementById('auth-loading');

        if (authBtn) authBtn.style.display = 'none';
        if (loading) loading.style.display = 'flex';

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
                    Interfaz.mostrarNotificacion('¡Registro exitoso! Revisa tu correo.');
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
            if (authBtn) authBtn.style.display = 'block';
            if (loading) loading.style.display = 'none';
        }
    }
};

window.Autenticacion = Autenticacion;
