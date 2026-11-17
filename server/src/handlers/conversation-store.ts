import type { ConversationTurn } from "../agents/agent.port";

export interface ConversationStoreOptions {
  maxConversations?: number;
  maxTurns?: number;
  maxCharsPerTurn?: number;
  ttlMs?: number;
  now?: () => number;
}

interface StoredConversation {
  turns: ConversationTurn[];
  updatedAt: number;
}

export class ConversationStore {
  private readonly conversations = new Map<string, StoredConversation>();
  private readonly maxConversations: number;
  private readonly maxTurns: number;
  private readonly maxCharsPerTurn: number;
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(options: ConversationStoreOptions = {}) {
    this.maxConversations = options.maxConversations ?? 200;
    this.maxTurns = options.maxTurns ?? 12;
    this.maxCharsPerTurn = options.maxCharsPerTurn ?? 2_000;
    this.ttlMs = options.ttlMs ?? 30 * 60 * 1_000;
    this.now = options.now ?? (() => Date.now());
  }

  getTurns(conversationId: string): ConversationTurn[] {
    this.pruneExpired();
    const entry = this.conversations.get(conversationId);
    if (!entry) return [];
    entry.updatedAt = this.now();
    this.conversations.delete(conversationId);
    this.conversations.set(conversationId, entry);
    return entry.turns.map((turn) => ({ ...turn }));
  }

  appendTurn(conversationId: string, turn: ConversationTurn): void {
    const trimmed = turn.content.trim();
    if (!trimmed) return;
    this.pruneExpired();

    const existing = this.conversations.get(conversationId);
    const turns = existing ? [...existing.turns] : [];
    turns.push({
      role: turn.role,
      content: trimmed.slice(0, this.maxCharsPerTurn),
    });
    const bounded = turns.slice(-this.maxTurns);

    if (existing) this.conversations.delete(conversationId);
    else if (this.conversations.size >= this.maxConversations) {
      const oldestKey = this.conversations.keys().next().value;
      if (oldestKey !== undefined) this.conversations.delete(oldestKey);
    }

    this.conversations.set(conversationId, {
      turns: bounded,
      updatedAt: this.now(),
    });
  }

  get size(): number {
    this.pruneExpired();
    return this.conversations.size;
  }

  private pruneExpired(): void {
    const cutoff = this.now() - this.ttlMs;
    for (const [id, entry] of this.conversations) {
      if (entry.updatedAt <= cutoff) {
        this.conversations.delete(id);
      }
    }
  }
}
