// ==========================================
// ¡Epa mi pana! Aquí guardamos las llaves del rancho.
// Configuraciones críticas de Supabase y constantes.
// ==========================================

window.DolarVE = {
    // Estas son las credenciales para conectar con Supabase
    SUPABASE_URL: 'https://urbyglfugcvzryuvivzf.supabase.co',
    SUPABASE_KEY: 'sb_publishable_FpTWpApM4-NPkkt_bYNilg_etUs_wtL',
    
    // Aquí guardaremos al usuario cuando inicie sesión
    supabase: null,
    usuario: null,
    
    // El baúl donde guardamos los precios del dólar actualizados
    tasas: {
        usd: 0,
        eur: 0,
        paralelo: 0,
        ars: 0,
        cop: 0,
        brl: 0,
        clp: 0
    },
    
    // Preferencias de la calculadora (se guardan en el navegador)
    config: {
        base: localStorage.getItem('dolarve_base') || 'bcv',
        direccion: localStorage.getItem('dolarve_direction') ? localStorage.getItem('dolarve_direction') === 'true' : true,
        calc: localStorage.getItem('dolarve_calc') || "1"
    }
};

// Inicializamos el cliente de Supabase de una vez si la librería está lista
if (window.supabase) {
    window.DolarVE.supabase = window.supabase.createClient(window.DolarVE.SUPABASE_URL, window.DolarVE.SUPABASE_KEY);
    console.log('[DolarVE] Cliente de Supabase inicializado con éxito, papá.');
} else {
    console.error('[DolarVE] ¡Mosca! No encontré la librería de Supabase.');
}
