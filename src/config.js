import { config } from 'dotenv';

// Carrega .env se existir (apenas desenvolvimento local)
try {
  config();
} catch {}

const required = (key, defaultValue) => {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória: ${key}`);
  }
  return value;
};

export default {
  // OpenAI
  openaiApiKey: required('OPENAI_API_KEY'),

  // Google Calendar — caminho pro JSON da service account
  googleServiceAccountPath: required('GOOGLE_SERVICE_ACCOUNT_PATH', './service-account.json'),

  // Número do dono (usado pra resolver JID de envio via onWhatsApp)
  ownerNumber: required('OWNER_NUMBER'),

  // JID(s) literais do dono (usado pra validar quem pode falar com o bot)
  // Aceita um ou mais JIDs separados por vírgula, ex:
  // OWNER_JIDS=212957413822602@lid,5511956003948@s.whatsapp.net
  ownerJids: (process.env.OWNER_JIDS || '').split(',').map(jid => jid.trim()).filter(Boolean),

  // Porta do servidor HTTP interno (pra receber lembretes)
  port: parseInt(process.env.PORT || '3001', 10),

  // Token secreto pra autenticar chamadas internas (ex: Lambda de lembretes)
  internalToken: required('INTERNAL_TOKEN', 'change-me-in-production'),

  // AWS — usado pelo DynamoDB (em produção a EC2 usa IAM Role)
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    dynamoDbTable: process.env.DYNAMODB_TABLE || 'calendar-agent-conversations',
  },

  // OpenAI model
  openaiModel: process.env.OPENAI_MODEL || 'gpt-5.4-mini',

  // Google Calendar — ID do calendário do dono (ex: seuemail@gmail.com)
  googleCalendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',

  // Telegram
  telegramBotToken: required('TELEGRAM_BOT_TOKEN'),
  // Chat ID do dono do bot no Telegram (preenchido automaticamente na primeira mensagem)
  telegramOwnerChatId: process.env.TELEGRAM_OWNER_CHAT_ID ? parseInt(process.env.TELEGRAM_OWNER_CHAT_ID, 10) : null,

  // Número máximo de mensagens no histórico por conversa
  maxHistory: parseInt(process.env.MAX_HISTORY || '20', 10),
};
