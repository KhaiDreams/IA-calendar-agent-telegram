import config from './config.js';

// Fallback em memória quando DynamoDB não está disponível (desenvolvimento local)
let localStore = {};

/**
 * Serviço de memória — usa DynamoDB em produção, fallback em memória local
 */
class MemoryService {
  /**
   * Salva uma interação no histórico (armazenamento local em memória)
   */
  async saveMessage(from, role, content) {
    const timestamp = Date.now();
    if (!localStore[from]) localStore[from] = [];
    localStore[from].push({ timestamp, role, content });
  }

  /**
   * Recupera o histórico recente de uma conversa
   */
  async getHistory(from, limit = config.maxHistory) {
    const history = (localStore[from] || []).slice(-limit);
    return history.map((i) => ({ role: i.role, content: i.content }));
  }

  /**
   * Limpa o histórico de uma conversa
   */
  async clearHistory(from) {
    delete localStore[from];
  }
}

export const memory = new MemoryService();