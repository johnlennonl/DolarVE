import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Lista de monedas a vigilar
    const targets = [
      { pair: 'USD/VES', url: 'https://ve.dolarapi.com/v1/dolares/oficial', label: 'Dólar' },
      { pair: 'EUR/VES', url: 'https://ve.dolarapi.com/v1/euros/oficial', label: 'Euro' }
    ];

    webpush.setVapidDetails(
      'mailto:admin@dolarve.com',
      Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
      Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
    );

    const { data: subs, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('id, subscription, device_id');

    if (subsError) {
      console.error('Error fetching subscriptions:', subsError);
      throw subsError;
    }

    console.log(`[push-notifier] Found ${subs?.length || 0} subscriptions`);

    let notificationsSent = 0;
    let subscriptionsCleaned = 0;

    for (const target of targets) {
      try {
        const response = await fetch(target.url);
        if (!response.ok) {
          console.warn(`[push-notifier] API ${target.pair} returned ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        const currentPrice = data.promedio;
        if (!currentPrice || currentPrice <= 0) continue;

        const { data: history } = await supabase
          .from('price_history')
          .select('last_price')
          .eq('pair', target.pair)
          .maybeSingle();

        const lastPrice = history?.last_price || 0;

        // Si el precio cambió más de 0.01 bs
        if (Math.abs(currentPrice - lastPrice) > 0.01) {
          const priceFormatted = currentPrice.toFixed(2);
          console.log(`[push-notifier] ${target.pair}: ${lastPrice} → ${currentPrice} (cambio detectado)`);

          // Enviar a cada suscriptor
          const expiredIds = [];

          if (subs && subs.length > 0) {
            for (const s of subs) {
              try {
                await webpush.sendNotification(
                  s.subscription, 
                  JSON.stringify({
                    title: `📈 Alerta DolarVE: ${target.label}`,
                    body: `El ${target.label} oficial cambió a Bs. ${priceFormatted}`,
                    icon: '/logo.png',
                    url: '/'
                  })
                );
                notificationsSent++;
              } catch (pushError) {
                console.error(`[push-notifier] Error enviando push a ${s.device_id || s.id}:`, pushError.statusCode, pushError.body);
                
                // Si el endpoint expiró (410 Gone) o es inválido (404), limpiar
                if (pushError.statusCode === 410 || pushError.statusCode === 404) {
                  expiredIds.push(s.id);
                }
              }
            }
          }

          // Limpiar suscripciones expiradas
          if (expiredIds.length > 0) {
            const { error: delError } = await supabase
              .from('push_subscriptions')
              .delete()
              .in('id', expiredIds);
            
            if (!delError) {
              subscriptionsCleaned = expiredIds.length;
              console.log(`[push-notifier] Limpiadas ${expiredIds.length} suscripciones expiradas`);
            }
          }

          // Actualizar precio en historial
          await supabase.from('price_history').upsert({ 
            pair: target.pair, 
            last_price: currentPrice, 
            updated_at: new Date().toISOString() 
          });
        } else {
          console.log(`[push-notifier] ${target.pair}: Sin cambio (${currentPrice})`);
        }
      } catch (innerErr) {
        console.error(`[push-notifier] Error processing ${target.pair}:`, innerErr);
      }
    }

    return new Response(JSON.stringify({ 
      ok: true, 
      sent: notificationsSent, 
      cleaned: subscriptionsCleaned,
      subscribers: subs?.length || 0
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error('[push-notifier] Fatal error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
