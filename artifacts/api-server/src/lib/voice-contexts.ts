/**
 * In-memory voice context store.
 *
 * Keeps conversation history (system prompt + prior turns) in RAM so that
 * voice-messages route never has to query the DB for history on every turn.
 * This is the same pattern LiveKit Agents uses with its ChatContext object.
 *
 * Lifecycle:
 *  - init()   called when a practice session is created
 *  - append() called after each voice turn (user + assistant messages)
 *  - get()    called at the start of each voice turn
 *  - delete() called when session ends (optional cleanup)
 *
 * Trade-offs:
 *  - Memory is lost on server restart → voice route falls back to DB on miss
 *  - No persistence required here; DB is the source of truth for transcripts
 */

export interface ContextMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

class VoiceContextStore {
  private readonly store = new Map<string, ContextMessage[]>();

  /** Initialize context for a new conversation with the system prompt. */
  init(conversationId: string, messages: ContextMessage[]): void {
    this.store.set(conversationId, [...messages]);
  }

  /**
   * Get the current context for a conversation.
   * Returns null if not found (e.g. server restarted — caller should load from DB).
   */
  get(conversationId: string): ContextMessage[] | null {
    return this.store.get(conversationId) ?? null;
  }

  /** Append a single message to an existing context. No-op if not found. */
  append(conversationId: string, message: ContextMessage): void {
    const msgs = this.store.get(conversationId);
    if (msgs) {
      msgs.push(message);
    }
  }

  /** Check whether a context exists in the store. */
  has(conversationId: string): boolean {
    return this.store.has(conversationId);
  }

  /** Remove a context (e.g. when session ends). */
  delete(conversationId: string): void {
    this.store.delete(conversationId);
  }
}

/** Singleton — imported by both practice route (init) and openai route (get/append). */
export const voiceContextStore = new VoiceContextStore();
