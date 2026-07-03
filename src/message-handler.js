import config from './config.js';
import { getSocket } from './baileys-client.js';
import { processMessage } from './openai-service.js';
import { memory } from './memory-service.js';

/**
 * Processa uma mensagem recebida do WhatsApp.
 *
 * REGRA: a resposta SEMPRE vai pro `from` (quem enviou a mensagem).
 * O `from` pode ser @lid ou @s.whatsapp.net — o Baileys aceita os dois.
 * NUNCA resolve o JID do dono pra enviar, porque o dono é quem RECEBE,
 * não quem ENVIA.
 */
export async function handleMessage(from, text, msg) {
  const sock = getSocket();
  if (!sock) {
    console.error('[Handler] Baileys não conectado');
    return;
  }

  // Valida se o remetente está na lista de JIDs autorizados
  if (!config.ownerJids.includes(from)) {
    console.log(`[Handler] Mensagem ignorada: ${from} não está em OWNER_JIDS`);
    await sock.sendMessage(from, {
      text: '🤖 Este assistente é privado e só atende o proprietário.',
    });
    return;
  }

  try {
    // Processa com OpenAI
    const history = await memory.getHistory(from);
    const response = await processMessage(text, history);

    // Salva histórico (fire-and-forget)
    memory.saveMessage(from, 'user', text).catch(() => {});
    memory.saveMessage(from, 'assistant', response).catch(() => {});

    // Envia resposta DIRETO pra quem mandou (from)
    await sock.sendMessage(from, { text: response });
    console.log(`[Handler] ✅ Resposta enviada para ${from}`);
  } catch (err) {
    console.error('[Handler] Erro:', err);
    try {
      await sock.sendMessage(from, {
        text: '❌ Desculpe, ocorreu um erro ao processar sua mensagem.',
      });
    } catch {}
  }
}