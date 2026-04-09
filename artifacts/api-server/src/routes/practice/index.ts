import { Router } from "express";
import { db } from "@workspace/db";
import {
  scenariosTable,
  categoriesTable,
  practiceSessionsTable,
  conversations,
  messages,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import {
  CreateSessionBody,
  GetSessionParams,
  GenerateFeedbackParams,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

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
  const scenarios = await db.select().from(scenariosTable).orderBy(scenariosTable.id);
  res.json(scenarios);
});

router.get("/practice/categories", async (_req, res) => {
  const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
  res.json(categories);
});

router.post("/practice/categories", async (req, res) => {
  const raw = req.body as { name?: string };
  const name = String(raw.name ?? "").trim();

  if (name.length < 2) {
    res.status(400).json({ error: "Invalid category name" });
    return;
  }

  const [created] = await db
    .insert(categoriesTable)
    .values({ name })
    .onConflictDoNothing({ target: categoriesTable.name })
    .returning();

  if (created) {
    res.status(201).json(created);
    return;
  }

  const [existing] = await db
    .select()
    .from(categoriesTable)
    .where(eq(categoriesTable.name, name));

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

  await db
    .insert(categoriesTable)
    .values({ name: body.category })
    .onConflictDoNothing({ target: categoriesTable.name });

  const [created] = await db.insert(scenariosTable).values(body).returning();
  res.status(201).json(created);
});

router.get("/practice/sessions", async (_req, res) => {
  const sessions = await db
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
    .orderBy(sql`${practiceSessionsTable.createdAt} DESC`);
  res.json(sessions);
});

router.post("/practice/sessions", async (req, res) => {
  const body = CreateSessionBody.parse(req.body);

  const [scenario] = await db
    .select()
    .from(scenariosTable)
    .where(eq(scenariosTable.id, body.scenarioId));

  if (!scenario) {
    res.status(404).json({ error: "Scenario not found" });
    return;
  }

  const [conv] = await db
    .insert(conversations)
    .values({ title: `${scenario.name} - Practice Session` })
    .returning();

  await db.insert(messages).values({
    conversationId: conv.id,
    role: "system",
    content: `${BASE_COACH_SYSTEM_PROMPT}

Scenario title: ${scenario.name}
Scenario category: ${scenario.category}
Scenario difficulty: ${scenario.difficulty}
Scenario details:
${scenario.systemPrompt}`,
  });

  const [session] = await db
    .insert(practiceSessionsTable)
    .values({
      scenarioId: body.scenarioId,
      conversationId: conv.id,
    })
    .returning();

  res.status(201).json({
    id: session.id,
    scenarioId: session.scenarioId,
    conversationId: session.conversationId,
    scenarioName: scenario.name,
    durationSeconds: session.durationSeconds,
    feedback: session.feedback,
    score: session.score,
    createdAt: session.createdAt,
  });
});

router.get("/practice/sessions/:id", async (req, res) => {
  const { id } = GetSessionParams.parse({ id: parseInt(req.params.id) });

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
    .where(eq(practiceSessionsTable.id, id));

  if (!row) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const msgRows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, row.conversationId))
    .orderBy(messages.createdAt);

  const visibleMessages = msgRows.filter((m) => m.role !== "system");

  res.json({
    id: row.id,
    scenarioId: row.scenarioId,
    conversationId: row.conversationId,
    scenarioName: row.scenarioName,
    durationSeconds: row.durationSeconds,
    feedback: row.feedback,
    score: row.score,
    createdAt: row.createdAt,
    messages: visibleMessages,
    scenario: row.scenario,
  });
});

router.post("/practice/sessions/:id/feedback", async (req, res) => {
  const { id } = GenerateFeedbackParams.parse({ id: parseInt(req.params.id) });

  const [row] = await db
    .select({
      id: practiceSessionsTable.id,
      conversationId: practiceSessionsTable.conversationId,
      scenario: scenariosTable,
    })
    .from(practiceSessionsTable)
    .innerJoin(scenariosTable, eq(practiceSessionsTable.scenarioId, scenariosTable.id))
    .where(eq(practiceSessionsTable.id, id));

  if (!row) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const msgRows = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, row.conversationId))
    .orderBy(messages.createdAt);

  const conversationText = msgRows
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role === "user" ? "User" : "AI Coach"}: ${m.content}`)
    .join("\n");

  const feedbackPrompt = `You are an expert English language coach specializing in IT workplace communication.

Analyze this English conversation practice session for an IT professional (Vietnamese learner) in the context of: ${row.scenario.name}

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
    model: "gpt-5.2",
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

  await db
    .update(practiceSessionsTable)
    .set({
      feedback: feedbackData.feedback,
      score: feedbackData.score,
    })
    .where(eq(practiceSessionsTable.id, id));

  res.json(feedbackData);
});

router.get("/practice/stats", async (_req, res) => {
  const sessions = await db
    .select({
      id: practiceSessionsTable.id,
      scenarioId: practiceSessionsTable.scenarioId,
      conversationId: practiceSessionsTable.conversationId,
      scenarioName: scenariosTable.name,
      durationSeconds: practiceSessionsTable.durationSeconds,
      feedback: practiceSessionsTable.feedback,
      score: practiceSessionsTable.score,
      createdAt: practiceSessionsTable.createdAt,
      category: scenariosTable.category,
    })
    .from(practiceSessionsTable)
    .innerJoin(scenariosTable, eq(practiceSessionsTable.scenarioId, scenariosTable.id))
    .orderBy(sql`${practiceSessionsTable.createdAt} DESC`);

  const totalSessions = sessions.length;
  const totalMinutes = Math.floor(
    sessions.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0) / 60
  );
  const scoredSessions = sessions.filter((s) => s.score !== null);
  const averageScore =
    scoredSessions.length > 0
      ? scoredSessions.reduce((sum, s) => sum + (s.score ?? 0), 0) / scoredSessions.length
      : 0;

  const sessionsByCategory: Record<string, number> = {};
  for (const s of sessions) {
    sessionsByCategory[s.category] = (sessionsByCategory[s.category] ?? 0) + 1;
  }

  const recentSessions = sessions.slice(0, 5).map((s) => ({
    id: s.id,
    scenarioId: s.scenarioId,
    conversationId: s.conversationId,
    scenarioName: s.scenarioName,
    durationSeconds: s.durationSeconds,
    feedback: s.feedback,
    score: s.score,
    createdAt: s.createdAt,
  }));

  res.json({
    totalSessions,
    totalMinutes,
    averageScore: Math.round(averageScore * 10) / 10,
    sessionsByCategory,
    recentSessions,
  });
});

export default router;
