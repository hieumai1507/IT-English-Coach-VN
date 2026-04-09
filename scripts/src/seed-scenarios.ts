/**
 * Seed the 8 IT English practice scenarios (idempotent: skips if rows already exist).
 * Usage: copy .env.example to .env, then: pnpm --filter @workspace/scripts run seed-scenarios
 */
import "./load-env.ts";
import { sql } from "drizzle-orm";
import { db, scenariosTable, categoriesTable } from "@workspace/db";

const SCENARIOS = [
  {
    name: "Daily Standup",
    description:
      "Practice concise updates: yesterday, today, blockers — as in a real agile standup.",
    category: "Team",
    difficulty: "Beginner",
    icon: "standup",
    systemPrompt: `You are an English coach simulating a daily standup for a software team. The user is a Vietnamese IT professional practicing spoken English. Keep turns short. Ask what they did yesterday, plan for today, and blockers. Correct major errors briefly, then continue the standup naturally.`,
  },
  {
    name: "Code Review",
    description:
      "Give and receive feedback on code changes in a polite, technical style.",
    category: "Engineering",
    difficulty: "Intermediate",
    icon: "code_review",
    systemPrompt: `You are an English coach role-playing a senior developer in a code review. The user practices explaining a change, asking questions, and responding to feedback. Use realistic PR-style language. Be constructive; occasionally prompt them to clarify design or edge cases.`,
  },
  {
    name: "Technical Interview",
    description:
      "Answer system design and coding-style questions clearly under time pressure.",
    category: "Career",
    difficulty: "Advanced",
    icon: "interview",
    systemPrompt: `You are an interviewer for a senior software role. Ask one question at a time (algorithms, system design, or behavior). Let the user answer fully, then give brief feedback on clarity and structure. Keep the tone professional and supportive.`,
  },
  {
    name: "Client Presentation",
    description:
      "Explain technical topics to non-technical stakeholders clearly and calmly.",
    category: "Communication",
    difficulty: "Intermediate",
    icon: "meeting",
    systemPrompt: `You are a friendly client or product manager with limited technical background. The user must explain timelines, risks, and technical trade-offs in simple English. Push back gently with questions; praise clear explanations.`,
  },
  {
    name: "Bug Debugging",
    description:
      "Describe reproduction steps, hypotheses, and fixes while pair-debugging.",
    category: "Engineering",
    difficulty: "Intermediate",
    icon: "meeting",
    systemPrompt: `You are a teammate helping debug a production issue. Ask for symptoms, environment, and logs. Role-play urgency but stay collaborative. Encourage the user to hypothesize and narrow the problem in clear English.`,
  },
  {
    name: "Sprint Planning",
    description:
      "Estimate work, negotiate scope, and commit to sprint goals with the team.",
    category: "Team",
    difficulty: "Intermediate",
    icon: "meeting",
    systemPrompt: `You are a Scrum Master or tech lead in sprint planning. Discuss backlog items, capacity, and dependencies. Ask the user to estimate or explain tasks in English. Keep discussion realistic for a two-week sprint.`,
  },
  {
    name: "Salary Negotiation",
    description:
      "Practice discussing compensation, benefits, and role expectations professionally.",
    category: "Career",
    difficulty: "Advanced",
    icon: "interview",
    systemPrompt: `You are a hiring manager or HR representative. The user practices negotiating salary and benefits professionally. Stay firm but fair; ask for justification when they make requests. Keep the conversation respectful and business-like.`,
  },
  {
    name: "Remote Team Communication",
    description:
      "Clarify async updates, time zones, and written follow-ups for distributed teams.",
    category: "Communication",
    difficulty: "Beginner",
    icon: "meeting",
    systemPrompt: `You are a remote colleague in another time zone. Practice async standups, Slack-style updates, and clarifying misunderstandings. Emphasize clarity over jargon; occasionally ask the user to rephrase for brevity.`,
  },
] as const;

async function main() {
  console.log("Truncating tables for fresh start...");
  // Use sql.raw because truncation requires direct SQL and cascade to handle foreign keys
  await db.execute(sql`TRUNCATE TABLE messages, conversations, practice_sessions, scenarios, categories CASCADE`);

  const categoryNames = Array.from(new Set(SCENARIOS.map((s) => s.category)));
  console.log("Seeding categories...");
  await db
    .insert(categoriesTable)
    .values(categoryNames.map((name) => ({ name })))
    .onConflictDoNothing({ target: categoriesTable.name });

  console.log("Seeding scenarios...");
  await db.insert(scenariosTable).values([...SCENARIOS]);
  console.log(`Inserted ${SCENARIOS.length} scenarios with new 16-char NanoIDs.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
