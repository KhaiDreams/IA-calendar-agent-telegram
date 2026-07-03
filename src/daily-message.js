import { readFileSync } from 'fs';
import * as calendar from './calendar-service.js';

const verses = JSON.parse(readFileSync(new URL('./bible-verses.json', import.meta.url), 'utf-8'));

/**
 * Retorna um versículo aleatório da lista
 */
export function getRandomVerse() {
  const i = Math.floor(Math.random() * verses.length);
  return verses[i];
}

/**
 * Gera a mensagem diária: versículo + agenda do dia + personalidade ranzinza
 * @returns {string}
 */
export async function generateDailyMessage() {
  const today = new Date().toISOString().split('T')[0];

  // Versículo aleatório
  const verse = getRandomVerse();

  // Eventos do dia
  let agendaText = 'Nada. Pelo menos você descansa.';
  try {
    const events = await calendar.listEvents({ startDate: today });
    if (events && events.length > 0) {
      agendaText = events
        .map(e => {
          const start = e.start?.dateTime || e.start?.date;
          const time = start ? new Date(start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '?';
          return `• ${time} — ${e.summary}`;
        })
        .join('\n');
    }
  } catch (err) {
    console.error('[Daily] Erro ao buscar agenda:', err.message);
  }

  const weekday = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return [
    `☀️ *Bom dia.* ${weekday}. Se é que pode ser bom.`,
    ``,
    `📖 *${verse.ref}*: "${verse.text}"`,
    ``,
    `📅 *Hoje você tem:*`,
    agendaText,
    ``,
    `Vai fazer algo útil ou vai enrolar de novo?`,
  ].join('\n');
}