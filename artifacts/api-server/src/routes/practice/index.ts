import { Router } from "express";
import { 
  db,
  scenarioRepo,
  categoryRepo,
  practiceSessionRepo,
  conversationRepo,
  messageRepo,
  categoriesTable, // Still needed for onConflict
  scenariosTable,   // Still needed for specific fields in stats
  practiceSessionsTable, // Still needed for specific fields in stats
  Category,
  Message
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  CreateSessionBody,
  GetSessionParams,
  GenerateFeedbackParams,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { voiceContextStore } from "../../lib/voice-contexts";

const router = Router();
type CreateScenarioBody = {
  name: string;
  description: string;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  icon: string;
  systemPrompt: string;
};

const BASE_COACH_SYSTEM_PROMPT = `You are an English speaking coach for Vietnamese IT professionals.
Keep role-play realistic and supportive.

Core behavior for every user turn:
1) Continue the scenario naturally (as a colleague/client/interviewer).
2) Briefly correct major mistakes:
   - Pronunciation/spoken-form issues (based on transcript clues)
   - Grammar
   - Word choice and professional tone
3) Provide:
   - one smoother version of the user's sentence
   - one additional useful sentence for this exact situation
4) Keep corrections concise: 1-3 short bullets max, then continue conversation.
5) Adapt difficulty progressively:
   - beginner: shorter sentences, slower pace
   - intermediate: normal workplace pace, moderate vocabulary
   - advanced: nuanced negotiation/discussion language

Do not be harsh. Prioritize clarity, confidence, and practical workplace English.`;

router.get("/practice/scenarios", async (_req, res) => {
  const scenarios = await scenarioRepo.findAll();
  res.json(scenarios);
});

router.get("/practice/categories", async (_req, res) => {
  const categories = await categoryRepo.findAll();
  res.json(categories);
});

router.post("/practice/categories", async (req, res) => {
  const raw = req.body as { name?: string };
  const name = String(raw.name ?? "").trim();

  if (name.length < 2) {
    res.status(400).json({ error: "Invalid category name" });
    return;
  }

  // Categories are simple, we keep the unique check logic
  const created = await categoryRepo.create({ name }).catch(() => null);

  if (created) {
    res.status(201).json(created);
    return;
  }

  // If failed (likely unique constraint), find the existing one
  const all = await categoryRepo.findAll();
  const existing = all.find((c: Category) => c.name === name);

  if (!existing) {
    res.status(500).json({ error: "Category lookup failed after conflict" });
    return;
  }

  res.status(200).json(existing);
});

router.post("/practice/scenarios", async (req, res) => {
  const raw = req.body as Partial<CreateScenarioBody>;
  const body: CreateScenarioBody = {
    name: String(raw.name ?? "").trim(),
    description: String(raw.description ?? "").trim(),
    category: String(raw.category ?? "").trim(),
    difficulty:
      raw.difficulty === "beginner" || raw.difficulty === "advanced"
        ? raw.difficulty
        : "intermediate",
    icon: String(raw.icon ?? "default").trim() || "default",
    systemPrompt: String(raw.systemPrompt ?? "").trim(),
  };

  if (
    body.name.length < 3 ||
    body.description.length < 10 ||
    body.category.length < 2 ||
    body.systemPrompt.length < 30
  ) {
    res.status(400).json({ error: "Invalid scenario payload" });
    return;
  }

  // Ensure category exists
  const cats = await categoryRepo.findAll();
  if (!cats.some((c: Category) => c.name === body.category)) {
    await categoryRepo.create({ name: body.category });
  }

  const created = await scenarioRepo.create(body);
  res.status(201).json(created);
});

router.get("/practice/sessions", async (_req, res) => {
  const sessions = await practiceSessionRepo.findAllWithScenario();
  res.json(sessions);
});

router.post("/practice/sessions", async (req, res) => {
  const body = CreateSessionBody.parse(req.body);

  const scenario = await scenarioRepo.findOneById(body.scenarioId);
  if (!scenario) {
    res.status(404).json({ error: "Scenario not found" });
    return;
  }

  const sessionData = await db.transaction(async (tx) => {
    // We still use transactions for complex atomic ops, 
    // but the logic remains centered around our entity structure
    // Build the full system message that will be used for every voice turn
    const systemContent = `${BASE_COACH_SYSTEM_PROMPT}

Scenario title: ${scenario.name}
Scenario category: ${scenario.category}
Scenario difficulty: ${scenario.difficulty}
Scenario details:
${scenario.systemPrompt}`;

    const [conv] = await tx
      .insert(conversationRepo["table"])
      .values({ title: `${scenario.name} - Practice Session` })
      .returning();

    await tx.insert(messageRepo["table"]).values({
      conversationId: conv.id,
      role: "system",
      content: systemContent,
    });

    const [session] = await tx
      .insert(practiceSessionRepo["table"])
      .values({
        scenarioId: body.scenarioId,
        conversationId: conv.id,
      })
      .returning();

    // Init the in-memory voice context so the first voice turn
    // never needs to query the DB for history.
    voiceContextStore.init(conv.id, [
      { role: "system", content: systemContent },
    ]);

    return session;
  });

  res.status(201).json({
    id: sessionData.id,
    scenarioId: sessionData.scenarioId,
    conversationId: sessionData.conversationId,
    scenarioName: scenario.name,
    durationSeconds: sessionData.durationSeconds,
    feedback: sessionData.feedback,
    score: sessionData.score,
    createdAt: sessionData.createdAt,
    updatedAt: sessionData.updatedAt
  });
});

router.get("/practice/sessions/:id", async (req, res) => {
  const { id } = GetSessionParams.parse({ id: req.params.id });
  const row = await practiceSessionRepo.findOneWithScenarioAndMessages(id);

  if (!row) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const visibleMessages = row.messages.filter((m: Message) => m.role !== "system");

  res.json({
    ...row,
    messages: visibleMessages,
  });
});

router.post("/practice/sessions/:id/feedback", async (req, res) => {
  const { id } = GenerateFeedbackParams.parse({ id: req.params.id });
  const row = await practiceSessionRepo.findOneWithScenarioAndMessages(id);

  if (!row) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const conversationText = row.messages
    .filter((m: Message) => m.role !== "system")
    .map((m: Message) => `${m.role === "user" ? "User" : "AI Coach"}: ${m.content}`)
    .join("\n");

  const feedbackPrompt = `You are an expert English language coach specializing in IT workplace communication.

Analyze this English conversation practice session for an IT professional (Vietnamese learner) in the context of: ${row.scenarioName}

CONVERSATION:
${conversationText}

Provide a JSON response with:
1. "feedback": 2 concise paragraphs summarizing strengths and top priorities
2. "score": integer 0-100 based on grammar, fluency, clarity, and professional communication
3. "suggestions": array of 4-6 actionable tips

Also evaluate learning progression and include these sections in the "feedback" text:
- "Progression today": what improved during the session
- "Next-step focus": what to train in the next session
- At least 2 concrete corrections with this format:
  Original: "..."
  Better: "..."
  Why: ...
- At least 1 alternative polished sentence for workplace use
- At least 1 extra sentence the learner could use in the same situation

Respond ONLY with valid JSON, no markdown.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 8192,
    messages: [{ role: "user", content: feedbackPrompt }],
  });

  let feedbackData = { feedback: "", score: 70, suggestions: [] as string[] };
  try {
    const raw = response.choices[0]?.message?.content ?? "{}";
    feedbackData = JSON.parse(raw);
  } catch {
    feedbackData = {
      feedback: response.choices[0]?.message?.content ?? "Good effort! Keep practicing.",
      score: 70,
      suggestions: ["Practice more regularly", "Focus on technical vocabulary", "Listen to native speakers"],
    };
  }

  await practiceSessionRepo.update(id, {
    feedback: feedbackData.feedback,
    score: feedbackData.score,
  });

  res.json(feedbackData);
});

router.get("/practice/stats", async (_req, res) => {
  // Stats still need some direct aggregate logic but we can keep it clean
  const [stats] = await db
    .select({
      totalSessions: sql<number>`count(${practiceSessionsTable.id})`,
      totalDuration: sql<number>`sum(coalesce(${practiceSessionsTable.durationSeconds}, 0))`,
      averageScore: sql<number>`avg(${practiceSessionsTable.score})`,
    })
    .from(practiceSessionsTable)
    .where(sql`${practiceSessionsTable.deletedAt} IS NULL`);

  const categoryStats = await db
    .select({
      category: scenariosTable.category,
      count: sql<number>`count(${practiceSessionsTable.id})`,
    })
    .from(practiceSessionsTable)
    .innerJoin(scenariosTable, eq(practiceSessionsTable.scenarioId, scenariosTable.id))
    .where(sql`${practiceSessionsTable.deletedAt} IS NULL`)
    .groupBy(scenariosTable.category);

  const recentSessions = await practiceSessionRepo.findAllWithScenario();

  const sessionsByCategory: Record<string, number> = {};
  for (const cs of categoryStats) {
    if (cs.category) {
      sessionsByCategory[cs.category] = Number(cs.count);
    }
  }

  res.json({
    totalSessions: Number(stats.totalSessions),
    totalMinutes: Math.floor(Number(stats.totalDuration) / 60),
    averageScore: Math.round(Number(stats.averageScore || 0) * 10) / 10,
    sessionsByCategory,
    recentSessions: recentSessions.slice(0, 5),
  });
});

export default router;
