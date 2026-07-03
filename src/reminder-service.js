/**
 * Serviço de lembretes com timer.
 * Guarda remiders em memória (sobrevive enquanto o processo roda).
 */

const reminders = new Map();

/**
 * @param {Object} ctx - Telegram context (ou null se chamado internamente)
 * @param {Function} sendFn - Função que envia mensagem
 * @param {string} chatId - Chat ID do Telegram
 */
let botCtx = { sendFn: null, chatId: null };

export function setBotContext(chatId, sendFn) {
  botCtx.chatId = chatId;
  botCtx.sendFn = sendFn;
}

/**
 * Agenda um lembrete
 * @param {string} id - ID único
 * @param {string} message - Texto do lembrete
 * @param {Date} remindAt - Data/hora pra disparar
 */
export function scheduleReminder(id, message, remindAt) {
  // Cancela existente se já tiver
  cancelReminder(id);

  const now = Date.now();
  const delay = remindAt.getTime() - now;

  if (delay <= 0) {
    console.log(`[Reminder] Ignorado: ${id} já passou (${remindAt.toISOString()})`);
    return false;
  }

  const timeout = setTimeout(async () => {
    console.log(`[Reminder] Disparando: ${id} — "${message}"`);
    reminders.delete(id);

    if (botCtx.sendFn && botCtx.chatId) {
      try {
        await botCtx.sendFn(botCtx.chatId, `🔔 *Lembrete:* ${message}`);
      } catch (err) {
        console.error('[Reminder] Erro ao enviar:', err.message);
      }
    }
  }, delay);

  reminders.set(id, { timeout, message, remindAt });
  console.log(`[Reminder] Agendado: "${message}" para ${remindAt.toISOString()} (em ${Math.round(delay / 60000)} min)`);

  return true;
}

/**
 * Cancela um lembrete
 */
export function cancelReminder(id) {
  const existing = reminders.get(id);
  if (existing) {
    clearTimeout(existing.timeout);
    reminders.delete(id);
    console.log(`[Reminder] Cancelado: ${id}`);
    return true;
  }
  return false;
}

/**
 * Lista lembretes ativos
 */
export function listReminders() {
  const result = [];
  for (const [id, r] of reminders) {
    result.push({ id, message: r.message, remindAt: r.remindAt.toISOString() });
  }
  return result;
}