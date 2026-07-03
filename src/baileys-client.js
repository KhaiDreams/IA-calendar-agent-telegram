import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';

const logger = pino({ level: 'silent' });

let sock = null;
let onMessageCallback = null;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

export function onMessage(callback) {
  onMessageCallback = callback;
}

export function getSocket() {
  return sock;
}

export async function startBaileys() {
  // Evita múltiplas conexões simultâneas
  if (isConnecting) {
    console.log('[Baileys] Já está conectando, ignorando...');
    return;
  }

  isConnecting = true;

  try {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger,
      browser: ['Calendar Agent', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      // Não tenta reconectar automaticamente, nós gerenciamos
      shouldSyncHistory: false,
    });

    // QR code handler
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        reconnectAttempts = 0; // Reseta tentativas ao mostrar QR
        console.log('\n📱 Escaneie o QR code abaixo com o WhatsApp:\n');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
        isConnecting = false;

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        console.log(
          `[Baileys] Conexão fechada. Status: ${statusCode || 'desconhecido'}` +
          (lastDisconnect?.error ? ` Erro: ${lastDisconnect.error.message}` : '')
        );

        // Se deslogou (qualquer motivo), não reconecta automaticamente
        if (isLoggedOut || statusCode === 401) {
          console.log('[Baileys] ❌ Deslogado. Delete a pasta auth_info e reinicie o bot.');
          console.log('[Baileys] Motivo:', lastDisconnect?.error?.message || 'desconhecido');
          return;
        }

        // Reconexão com backoff exponencial
        reconnectAttempts++;
        if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
          console.log(`[Baileys] ❌ Máximo de ${MAX_RECONNECT_ATTEMPTS} tentativas atingido. Desistindo.`);
          return;
        }

        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
        console.log(`[Baileys] Reconectando em ${delay / 1000}s... (tentativa ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        setTimeout(() => startBaileys(), delay);
      }

      if (connection === 'open') {
        isConnecting = false;
        reconnectAttempts = 0;
        console.log('[Baileys] ✅ Conectado ao WhatsApp!');
      }
    });

    // Salva credenciais automaticamente
    sock.ev.on('creds.update', saveCreds);

    // Mensagens recebidas
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        // Ignora mensagens próprias (enviadas pelo bot)
        if (msg.key.fromMe) continue;

        // Ignora mensagens de grupos
        if (msg.key.remoteJid.endsWith('@g.us')) continue;

        // Extrai texto — tenta vários formatos
        const text =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          '';

        if (!text.trim()) continue;

        const from = msg.key.remoteJid;

        console.log(`[WhatsApp] ✅ Mensagem recebida de ${from}: ${text}`);

        if (onMessageCallback) {
          try {
            await onMessageCallback(from, text, msg);
          } catch (err) {
            console.error('[Handler] Erro ao processar mensagem:', err);
            try {
              await sock.sendMessage(from, {
                text: '❌ Ocorreu um erro interno. Tente novamente.',
              });
            } catch {}
          }
        }
      }
    });

    return sock;
  } catch (err) {
    isConnecting = false;
    console.error('[Baileys] Erro ao iniciar:', err);
    throw err;
  }
}