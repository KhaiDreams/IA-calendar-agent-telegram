import express from 'express';
import config from './config.js';
import { getSocket } from './baileys-client.js';

/**
 * Servidor HTTP interno para receber requisições do Lambda de lembretes
 * Rota: POST /send
 * Body: { to: "5511999999999@s.whatsapp.net", text: "mensagem" }
 * Header: x-internal-token (autenticação)
 */
export function startHttpServer() {
  const app = express();
  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', connected: !!getSocket() });
  });

  // Rota pra enviar mensagem (usada pelo Lambda de lembretes)
  app.post('/send', async (req, res) => {
    // Verifica token interno
    const token = req.headers['x-internal-token'];
    if (token !== config.internalToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { to, text } = req.body;
    if (!to || !text) {
      return res.status(400).json({ error: 'Missing required fields: to, text' });
    }

    const sock = getSocket();
    if (!sock) {
      return res.status(503).json({ error: 'WhatsApp not connected' });
    }

    try {
      await sock.sendMessage(to, { text });
      console.log(`[HTTP] Mensagem enviada para ${to}: ${text}`);
      res.json({ success: true });
    } catch (err) {
      console.error('[HTTP] Erro ao enviar mensagem:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.listen(config.port, () => {
    console.log(`[HTTP] Servidor interno rodando na porta ${config.port}`);
  });
}