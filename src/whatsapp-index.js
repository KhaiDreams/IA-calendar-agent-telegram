import { startBaileys, onMessage } from './baileys-client.js';
import { startHttpServer } from './http-server.js';
import { handleMessage } from './message-handler.js';

console.log('═══════════════════════════════════════');
console.log('  Calendar Agent — Assistente WhatsApp');
console.log('═══════════════════════════════════════\n');

// Inicia servidor HTTP interno (pra receber lembretes)
startHttpServer();

// Conecta no WhatsApp
startBaileys().then(() => {
  console.log('[App] Baileys iniciado. Aguardando QR code...\n');
});

// Registra handler de mensagens
onMessage(handleMessage);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[App] Encerrando...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[App] Encerrando...');
  process.exit(0);
});