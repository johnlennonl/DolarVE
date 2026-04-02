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

    // List of currencies to monitor
    const targets = [
      { pair: 'USD/VES', url: 'https://ve.dolarapi.com/v1/dolares/oficial', label: 'Dólar' },
      { pair: 'EUR/VES', url: 'https://ve.dolarapi.com/v1/euros/oficial', label: 'Euro' }
    ];

    webpush.setVapidDetails(
      'mailto:admin@dolarve.com',
      Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
      Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
    );

    const { data: subs } = await supabase.from('push_subscriptions').select('subscription');

    for (const target of targets) {
      try {
        const response = await fetch(target.url);
        if (!response.ok) continue;
        
        const data = await response.json();
        const currentPrice = data.promedio;

        const { data: history } = await supabase
          .from('price_history')
          .select('last_price')
          .eq('pair', target.pair)
          .maybeSingle();

        const lastPrice = history?.last_price || 0;

        // Threshold check (more than 0.01 bolivars)
        if (Math.abs(currentPrice - lastPrice) > 0.01) {
          const priceFormatted = currentPrice.toFixed(2);

          const notifications = subs?.map((s) => 
            webpush.sendNotification(s.subscription, JSON.stringify({
              title: `📈 Alerta DolarVE: ${target.label}`,
              body: `El ${target.label} oficial cambió a Bs. ${priceFormatted}`,
              icon: 'https://dolarve.com/logo.png' // Ensure this is a valid public URL
            })).catch(e => console.error(`Failed individual push for ${target.label}:`, e))
          );

          if (notifications) await Promise.all(notifications);
          await supabase.from('price_history').upsert({ 
            pair: target.pair, 
            last_price: currentPrice, 
            updated_at: new Date().toISOString() 
          });
        }
      } catch (innerErr) {
        console.error(`Error processing ${target.pair}:`, innerErr);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
