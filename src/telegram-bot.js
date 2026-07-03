import { Telegraf } from 'telegraf';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import config from './config.js';
import { processMessage } from './openai-service.js';
import { memory } from './memory-service.js';

const ENV_PATH = new URL('../.env', import.meta.url).pathname;

/**
 * Atualiza o TELEGRAM_OWNER_CHAT_ID no arquivo .env
 */
function saveOwnerChatId(chatId) {
  try {
    if (!existsSync(ENV_PATH)) return;

    let content = readFileSync(ENV_PATH, 'utf-8');

    if (content.includes('TELEGRAM_OWNER_CHAT_ID=')) {
      content = content.replace(
        /TELEGRAM_OWNER_CHAT_ID=.*/,
        `TELEGRAM_OWNER_CHAT_ID=${chatId}`
      );
    } else {
      content += `\nTELEGRAM_OWNER_CHAT_ID=${chatId}\n`;
    }

    writeFileSync(ENV_PATH, content);
    console.log(`[Telegram] Chat ID salvo no .env: ${chatId}`);
  } catch (err) {
    console.error('[Telegram] Erro ao salvar chat ID:', err.message);
  }
}

/**
 * Inicia o bot do Telegram com polling
 */
export function startTelegramBot() {
  const bot = new Telegraf(config.telegramBotToken);

  // Middleware global: valida se é o dono
  bot.use(async (ctx, next) => {
    // Ignora updates que não são mensagens de texto
    if (!ctx.message || !ctx.message.text) return;

    const chatId = ctx.message.chat.id;

    // Primeira mensagem: registra o dono
    if (!config.telegramOwnerChatId) {
      console.log(`[Telegram] Primeira mensagem detectada! Chat ID: ${chatId}`);
      config.telegramOwnerChatId = chatId;
      saveOwnerChatId(chatId);

      // Envia boas-vindas
      await ctx.reply('👋 Olá! Eu sou seu assistente pessoal de calendário.\n\n'
        + 'Posso ajudá-lo a:\n'
        + '📅 Criar, listar e gerenciar eventos no Google Calendar\n'
        + '⏰ Definir lembretes\n'
        + '💬 Conversar naturalmente sobre sua agenda\n\n'
        + 'Como posso ajudá-lo agora?');
      return;
    }

    // Não é o dono
    if (chatId !== config.telegramOwnerChatId) {
      console.log(`[Telegram] Mensagem ignorada de chat não autorizado: ${chatId}`);
      await ctx.reply('🤖 Este assistente é privado e só atende o proprietário.');
      return;
    }

    await next();
  });

  // Handler de mensagens
  bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    const chatId = ctx.message.chat.id.toString();
    const from = `telegram:${chatId}`;

    console.log(`[Telegram] Mensagem recebida de ${chatId}: ${text}`);

    // Indica que o bot está digitando
    await ctx.sendChatAction('typing');

    try {
      // Recupera histórico da conversa
      const history = await memory.getHistory(from);

      // Processa com OpenAI
      const response = await processMessage(text, history);

      // Salva no histórico (fire-and-forget)
      memory.saveMessage(from, 'user', text).catch(() => {});
      memory.saveMessage(from, 'assistant', response).catch(() => {});

      // Envia resposta. Se for muito longa, usa MarkdownV2
      if (response.length > 4000) {
        // Telelegram limita a 4096 caracteres
        for (let i = 0; i < response.length; i += 4000) {
          await ctx.reply(response.slice(i, i + 4000));
        }
      } else {
        await ctx.reply(response);
      }

      console.log(`[Telegram] Resposta enviada para ${chatId}`);
    } catch (err) {
      console.error('[Telegram] Erro ao processar mensagem:', err);
      await ctx.reply('❌ Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.');
    }
  });

  // Inicia o bot
  bot.launch(() => {
    console.log('[Telegram] ✅ Bot iniciado e aguardando mensagens...');
    console.log('[Telegram] Acesse: https://t.me/acessor_pessoal_agenda_bot');
  });

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  return bot;
}