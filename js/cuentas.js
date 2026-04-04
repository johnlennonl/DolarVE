// ==========================================

const Cuentas = {
    // Mapa de iconos oficiales por banco
    getBankIcon(banco) {
        const b = (banco || "").toUpperCase();
        if (b.includes('BANESCO')) return 'img/bancos/banesco.png';
        if (b.includes('MERCANTIL')) return 'img/bancos/bancoMercantil.png';
        if (b.includes('VENEZUELA')) return 'img/bancos/bancoVenezuela.png';
        if (b.includes('PROVINCIAL')) return 'img/bancos/bancoProvincial.png';
        if (b.includes('BNC') || b.includes('NACIONAL DE CREDITO')) return 'img/bancos/banconacionaldecredito.png';
        if (b.includes('BANCAMIGA')) return 'img/bancos/bancamiga.png';
        if (b.includes('BANCARIBE')) return 'img/bancos/bancaribe.png';
        if (b.includes('EXTERIOR')) return 'img/bancos/bancoExterior.png';
        return null;
    },

    // Función para traer todas las cuentas guardadas del usuario
    async cargarCuentas() {
        if (!window.DolarVE.supabase || !window.DolarVE.usuario) return;
        
        const listContainer = document.getElementById('pm-accounts-list');
        if (!listContainer) return;
        
        const { data: accounts, error } = await window.DolarVE.supabase
            .from('cuentas_pago_movil')
            .select('*')
            .eq('user_id', window.DolarVE.usuario.id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[DolarVE] Error cargando cuentas:', error);
            return;
        }

        // Guardamos en el almacén global para que la calculadora las vea
        window.DolarVE.cuentas = accounts;

        if (accounts.length === 0) {
            listContainer.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: var(--text-muted); font-size: 13px;">
                    <i class="ph-duotone ph-wallet" style="font-size: 32px; opacity: 0.2; display: block; margin-bottom: 12px;"></i>
                    Mano, no tienes cuentas guardadas aún.<br>Agrega una para generar tus recibos.
                </div>
            `;
            return;
        }

        // Pintamos las cuentas en la lista
        listContainer.innerHTML = accounts.map(acc => {
            const logo = this.getBankIcon(acc.banco_nombre);
            const logoHtml = logo 
                ? `<img src="${logo}" class="account-bank-icon">`
                : `<i class="ph-duotone ph-bank" style="font-size: 20px; color: var(--accent-green); opacity: 0.5;"></i>`;

            return `
                <div class="account-item">
                    <div class="account-bank-logo">
                        ${logoHtml}
                    </div>
                    <div class="account-info">
                        <div style="font-weight: 700; color: #fff; font-size: 14px;">${acc.banco_nombre}</div>
                        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                            ${acc.tipo_documento}${acc.numero_documento} • ${acc.prefijo_tel}-${acc.numero_tel}
                        </div>
                    </div>
                    <button class="delete-account-btn" onclick="Cuentas.eliminarCuenta('${acc.id}', this)">
                        <i class="ph-duotone ph-trash"></i>
                    </button>
                </div>
            `;
        }).join('');
    },

    // Para borrar esa cuenta que ya no usas
    async eliminarCuenta(id, boton) {
        if (!confirm('¿Seguro que quieres borrar esta cuenta, chamo?')) return;
        
        const iconoOriginal = boton.innerHTML;
        boton.innerHTML = '<i class="ph-duotone ph-circle-notch ph-spin"></i>';
        
        const { error } = await window.DolarVE.supabase
            .from('cuentas_pago_movil')
            .delete()
            .eq('id', id);

        if (error) {
            Interfaz.mostrarNotificacion('Error: ' + error.message);
            boton.innerHTML = iconoOriginal;
        } else {
            Interfaz.mostrarNotificacion('Cuenta eliminada. ¡Listo!');
            this.cargarCuentas();
        }
    },

    // Para registrar un nuevo Pago Móvil
    async guardarCuenta(datos) {
        if (!window.DolarVE.supabase || !window.DolarVE.usuario) return;

        // Validación de campos (¡Mosca con dejar esto en blanco!)
        if (!datos.banco_nombre || !datos.numero_documento || !datos.numero_tel) {
            Interfaz.mostrarNotificacion('⚠️ ¡Epa! Rellena los datos del banco, cédula y teléfono.');
            return false;
        }

        const { error } = await window.DolarVE.supabase
            .from('cuentas_pago_movil')
            .insert({
                user_id: window.DolarVE.usuario.id,
                ...datos
            });

        if (error) {
            Interfaz.mostrarNotificacion('¡Mosca! Error guardando: ' + error.message);
            return false;
        } else {
            Interfaz.mostrarNotificacion('¡Cuenta guardada! Ya puedes cobrar.');
            
            // Limpiamos los campos del formulario
            document.getElementById('pm-etiqueta').value = '';
            document.getElementById('pm-banco').value = '';
            document.getElementById('pm-id-num').value = '';
            document.getElementById('pm-tel-num').value = '';
            
            // Cerramos el formulario con animación
            const form = document.getElementById('pm-add-form');
            if (form) form.classList.remove('show');

            this.cargarCuentas();
            return true;
        }
    }
};

window.Cuentas = Cuentas;
