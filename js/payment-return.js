import { getSupabaseClient } from './supabase.js';

const params = new URLSearchParams(window.location.search);
const sessionId = params.get('session_id') || '';
const isAppReturn = params.get('return_to_app') === '1';
const isCanceled = params.get('estado') === 'cancelado';
const title = document.getElementById('return-title');
const message = document.getElementById('return-message');
const icon = document.getElementById('return-icon');
const button = document.getElementById('return-button');

function openApp() {
  const appUrl = new URL('rocha7://pagamento-retorno');
  if (sessionId) appUrl.searchParams.set('session_id', sessionId);
  if (isCanceled) appUrl.searchParams.set('estado', 'cancelado');
  window.location.href = appUrl.toString();
}

async function verifyPayment() {
  if (isCanceled) {
    icon.textContent = '↺';
    title.textContent = 'Pagamento não concluído';
    message.textContent = 'O pedido continua salvo. Você pode voltar ao app e tentar novamente quando quiser.';
  } else if (sessionId) {
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.functions.invoke('rocha7-stripe-checkout', {
        body: { action: 'status', sessionId }
      });
      if (error) throw error;
      if (data?.status === 'pago') {
        icon.textContent = '✓';
        title.textContent = 'Pagamento confirmado';
        message.textContent = 'Obrigado pelo pedido! A equipe Rocha7 vai acompanhar a produção e a entrega.';
      } else {
        icon.textContent = '…';
        title.textContent = 'Pagamento em processamento';
        message.textContent = 'A Stripe ainda está confirmando o pagamento. O status será atualizado no seu app.';
      }
    } catch {
      title.textContent = 'Pedido recebido';
      message.textContent = 'Não foi possível consultar o pagamento agora. Volte ao app para conferir o status mais tarde.';
    }
  } else {
    title.textContent = 'Pedido recebido';
    message.textContent = 'Volte ao app Rocha7 para acompanhar o status do pedido.';
  }

  if (isAppReturn) {
    button.textContent = 'VOLTAR AO APLICATIVO';
    button.href = `rocha7://pagamento-retorno${window.location.search.replace(/return_to_app=1&?/, '').replace(/&$/, '')}`;
    button.addEventListener('click', (event) => { event.preventDefault(); openApp(); });
    window.setTimeout(openApp, 900);
  }
}

verifyPayment();
