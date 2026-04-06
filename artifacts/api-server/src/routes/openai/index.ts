import { Router } from "express";
import { db } from "@workspace/db";
import { conversations as conversationsTable, messages } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  CreateOpenaiConversationBody,
  SendOpenaiMessageBody,
  SendOpenaiVoiceMessageBody,
  GetOpenaiConversationParams,
  DeleteOpenaiConversationParams,
  ListOpenaiMessagesParams,
  SendOpenaiMessageParams,
  SendOpenaiVoiceMessageParams,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  voiceChatStream,
  ensureCompatibleFormat,
} from "@workspace/integrations-openai-ai-server/audio";

const router = Router();

router.get("/openai/conversations", async (req, res) => {
  const rows = await db
    .select()
    .from(conversationsTable)
    .orderBy(conversationsTable.createdAt);
  res.json(
    rows.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
    }))
  );
});

router.post("/openai/conversations", async (req, res) => {
  const body = CreateOpenaiConversationBody.parse(req.body);
  const [conv] = await db
    .insert(conversationsTable)
    .values({ title: body.title })
    .returning();
  res.status(201).json({ id: conv.id, title: conv.title, createdAt: conv.createdAt });
});

router.get("/openai/conversations/:id", async (req, res) => {
  const { id } = GetOpenaiConversationParams.parse({ id: parseInt(req.params.id) });
  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(messages.createdAt);
  res.json({
    id: conv.id,
    title: conv.title,
    createdAt: conv.createdAt,
    messages: msgs,
  });
});

router.delete("/openai/conversations/:id", async (req, res) => {
  const { id } = DeleteOpenaiConversationParams.parse({ id: parseInt(req.params.id) });
  const [conv] = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  await db.delete(messages).where(eq(messages.conversationId, id));
  await db.delete(conversationsTable).where(eq(conversationsTable.id, id));
  res.status(204).end();
});

router.get("/openai/conversations/:id/messages", async (req, res) => {
  const { id } = ListOpenaiMessagesParams.parse({ id: parseInt(req.params.id) });
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(messages.createdAt);
  res.json(msgs);
});

router.post("/openai/conversations/:id/messages", async (req, res) => {
  const { id } = SendOpenaiMessageParams.parse({ id: parseInt(req.params.id) });
  const body = SendOpenaiMessageBody.parse(req.body);

  const existingMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(messages.createdAt);

  await db.insert(messages).values({
    conversationId: id,
    role: "user",
    content: body.content,
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  const chatMessages = existingMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  chatMessages.push({ role: "user", content: body.content });

  const stream = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8192,
    messages: chatMessages,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      fullResponse += content;
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  }

  await db.insert(messages).values({
    conversationId: id,
    role: "assistant",
    content: fullResponse,
  });

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

router.post("/openai/conversations/:id/voice-messages", async (req, res) => {
  const { id } = SendOpenaiVoiceMessageParams.parse({ id: parseInt(req.params.id) });
  const body = SendOpenaiVoiceMessageBody.parse(req.body);

  const audioBuffer = Buffer.from(body.audio, "base64");

  if (audioBuffer.length < 100) {
    res.status(400).json({ error: "Audio buffer too small or empty. Please record at least 1 second." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const { buffer, format } = await ensureCompatibleFormat(audioBuffer);
  const stream = await voiceChatStream(buffer, "alloy", format);

  let assistantTranscript = "";
  let userTranscript = "";

  for await (const event of stream) {
    if (event.type === "transcript") {
      assistantTranscript += event.data;
    } else if (event.type === "user_transcript") {
      userTranscript += event.data;
    }
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  if (userTranscript) {
    await db.insert(messages).values({
      conversationId: id,
      role: "user",
      content: userTranscript,
    });
  }
  if (assistantTranscript) {
    await db.insert(messages).values({
      conversationId: id,
      role: "assistant",
      content: assistantTranscript,
    });
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
