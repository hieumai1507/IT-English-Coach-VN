import { BaseRepository } from "../utils/repository";
import { 
  scenariosTable, 
  categoriesTable, 
  conversations, 
  messages, 
  practiceSessionsTable 
} from "../schema";
import { db } from "../index";
import { eq, isNull, and, sql } from "drizzle-orm";

export class ScenarioRepository extends BaseRepository<typeof scenariosTable> {
  constructor() {
    super(scenariosTable, scenariosTable.id, scenariosTable.deletedAt);
  }
}

export class CategoryRepository extends BaseRepository<typeof categoriesTable> {
  constructor() {
    super(categoriesTable, categoriesTable.id, categoriesTable.deletedAt);
  }
}

export class ConversationRepository extends BaseRepository<typeof conversations> {
  constructor() {
    super(conversations, conversations.id, conversations.deletedAt);
  }
}

export class MessageRepository extends BaseRepository<typeof messages> {
  constructor() {
    super(messages, messages.id, messages.deletedAt);
  }
}

export class PracticeSessionRepository extends BaseRepository<typeof practiceSessionsTable> {
  constructor() {
    super(practiceSessionsTable, practiceSessionsTable.id, practiceSessionsTable.deletedAt);
  }

  async findAllWithScenario() {
    return db
      .select({
        id: practiceSessionsTable.id,
        scenarioId: practiceSessionsTable.scenarioId,
        conversationId: practiceSessionsTable.conversationId,
        scenarioName: scenariosTable.name,
        durationSeconds: practiceSessionsTable.durationSeconds,
        feedback: practiceSessionsTable.feedback,
        score: practiceSessionsTable.score,
        createdAt: practiceSessionsTable.createdAt,
      })
      .from(practiceSessionsTable)
      .innerJoin(scenariosTable, eq(practiceSessionsTable.scenarioId, scenariosTable.id))
      .where(isNull(practiceSessionsTable.deletedAt))
      .orderBy(sql`${practiceSessionsTable.createdAt} DESC`);
  }

  async findOneWithScenarioAndMessages(id: string) {
    const [row] = await db
      .select({
        id: practiceSessionsTable.id,
        scenarioId: practiceSessionsTable.scenarioId,
        conversationId: practiceSessionsTable.conversationId,
        scenarioName: scenariosTable.name,
        durationSeconds: practiceSessionsTable.durationSeconds,
        feedback: practiceSessionsTable.feedback,
        score: practiceSessionsTable.score,
        createdAt: practiceSessionsTable.createdAt,
        scenario: scenariosTable,
      })
      .from(practiceSessionsTable)
      .innerJoin(scenariosTable, eq(practiceSessionsTable.scenarioId, scenariosTable.id))
      .where(and(eq(practiceSessionsTable.id, id), isNull(practiceSessionsTable.deletedAt)));

    if (!row) return null;

    const msgRows = await db
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, row.conversationId), isNull(messages.deletedAt)))
      .orderBy(messages.createdAt);

    return { ...row, messages: msgRows };
  }
}

// Export singleton instances for easy use
export const scenarioRepo = new ScenarioRepository();
export const categoryRepo = new CategoryRepository();
export const conversationRepo = new ConversationRepository();
export const messageRepo = new MessageRepository();
export const practiceSessionRepo = new PracticeSessionRepository();
