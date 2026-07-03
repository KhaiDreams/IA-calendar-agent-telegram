/**
 * Lambda function para EventBridge Scheduler
 * Verifica eventos no Google Calendar nos próximos 30 minutos
 * e envia lembrete via WhatsApp (POST /send na EC2)
 *
 * Deploy: zipar e enviar como Lambda (Node 20.x)
 * Trigger: EventBridge Scheduler (a cada 5 minutos)
 * Env vars: EC2_URL, INTERNAL_TOKEN, GOOGLE_CREDENTIALS (JSON string)
 */

const { google } = require('googleapis');

// Cache do auth do Google
let calendar = null;

function getCalendar() {
  if (calendar) return calendar;

  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
  });

  calendar = google.calendar({ version: 'v3', auth });
  return calendar;
}

exports.handler = async (event) => {
  console.log('[ReminderChecker] Iniciando...');

  const ec2Url = process.env.EC2_URL;
  const internalToken = process.env.INTERNAL_TOKEN;
  const ownerNumber = process.env.OWNER_NUMBER;

  if (!ec2Url || !internalToken || !ownerNumber) {
    console.error('[ReminderChecker] Env vars faltando');
    return { statusCode: 500, body: 'Configuração incompleta' };
  }

  try {
    const cal = getCalendar();
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 60 * 1000);

    console.log(`[ReminderChecker] Buscando eventos entre ${now.toISOString()} e ${end.toISOString()}`);

    const response = await cal.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];
    console.log(`[ReminderChecker] Encontrados ${events.length} eventos`);

    for (const event of events) {
      const startTime = event.start?.dateTime || event.start?.date;
      const summary = event.summary || 'Evento sem título';

      const message = `🔔 *Lembrete:* ${summary}\n📅 ${new Date(startTime).toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })}`;

      console.log(`[ReminderChecker] Enviando lembrete: ${summary}`);

      const fetch = await import('node-fetch');
      const res = await fetch.default(`${ec2Url}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-token': internalToken,
        },
        body: JSON.stringify({
          to: `${ownerNumber}@s.whatsapp.net`,
          text: message,
        }),
      });

      if (!res.ok) {
        console.error(`[ReminderChecker] Erro ao enviar: ${res.status} ${await res.text()}`);
      } else {
        console.log(`[ReminderChecker] Lembrete enviado com sucesso`);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ sent: events.length }),
    };
  } catch (err) {
    console.error('[ReminderChecker] Erro:', err);
    return {
      statusCode: 500,
      body: err.message,
    };
  }
};