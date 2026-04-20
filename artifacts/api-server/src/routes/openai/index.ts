import { Router } from "express";
import { 
  conversationRepo, 
  messageRepo,
  Conversation,
  Message
} from "@workspace/db";
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
  type PriorMessage,
} from "@workspace/integrations-openai-ai-server/audio";

const router = Router();

router.get("/openai/conversations", async (req, res) => {
  const rows = await conversationRepo.findAll();
  res.json(
    rows.map((c: Conversation) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
    }))
  );
});

router.post("/openai/conversations", async (req, res) => {
  const body = CreateOpenaiConversationBody.parse(req.body);
  const conv = await conversationRepo.create({ title: body.title });
  res.status(201).json({ id: conv.id, title: conv.title, createdAt: conv.createdAt });
});

router.get("/openai/conversations/:id", async (req, res) => {
  const { id } = GetOpenaiConversationParams.parse({ id: req.params.id });
  const conv = await conversationRepo.findOneById(id);
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await messageRepo.findAll();
  const conversationMessages = msgs.filter((m: Message) => m.conversationId === id);
  
  res.json({
    id: conv.id,
    title: conv.title,
    createdAt: conv.createdAt,
    messages: conversationMessages,
  });
});

router.delete("/openai/conversations/:id", async (req, res) => {
  const { id } = DeleteOpenaiConversationParams.parse({ id: req.params.id });
  const exists = await conversationRepo.exists(id);
  if (!exists) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  // Soft delete the conversation. 
  // We can also soft delete messages if we want, but filtering at query time is enough.
  await conversationRepo.softDelete(id);
  res.status(204).end();
});

router.get("/openai/conversations/:id/messages", async (req, res) => {
  const { id } = ListOpenaiMessagesParams.parse({ id: req.params.id });
  const msgs = await messageRepo.findAll();
  res.json(msgs.filter((m: Message) => m.conversationId === id));
});

router.post("/openai/conversations/:id/messages", async (req, res) => {
  const { id } = SendOpenaiMessageParams.parse({ id: req.params.id });
  const body = SendOpenaiMessageBody.parse(req.body);

  const msgs = await messageRepo.findAll();
  const existingMessages = msgs.filter((m: Message) => m.conversationId === id);

  await messageRepo.create({
    conversationId: id,
    role: "user",
    content: body.content,
  });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";

  const chatMessages = existingMessages.map((m: Message) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));
  chatMessages.push({ role: "user", content: body.content });

  const controller = new AbortController();
  res.on("close", () => controller.abort());

  const stream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 8192,
    messages: chatMessages,
    stream: true,
  }, { signal: controller.signal });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      fullResponse += content;
      res.write(`data: ${JSON.stringify({ content })}\n\n`);
    }
  }

  await messageRepo.create({
    conversationId: id,
    role: "assistant",
    content: fullResponse,
  });

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

router.post("/openai/conversations/:id/voice-messages", async (req, res) => {
  const { id } = SendOpenaiVoiceMessageParams.parse({ id: req.params.id });
  const body = SendOpenaiVoiceMessageBody.parse(req.body);

  const audioBuffer = Buffer.from(body.audio, "base64");

  if (audioBuffer.length < 100) {
    res.status(400).json({ error: "Audio buffer too small or empty. Please record at least 1 second." });
    return;
  }

  // Fetch conversation history so the AI coach has full context.
  // Cap at system prompt + last 10 turns (20 messages) to keep token
  // costs bounded for long sessions without losing meaningful context.
  const MAX_HISTORY_TURNS = 10;
  const allMsgs = await messageRepo.findAll();
  const convMsgs = allMsgs.filter((m: Message) => m.conversationId === id);
  const systemMsg = convMsgs.find((m: Message) => m.role === "system");
  const nonSystemMsgs = convMsgs.filter((m: Message) => m.role !== "system");
  const recentMsgs = nonSystemMsgs.slice(-(MAX_HISTORY_TURNS * 2));
  const priorMessages: PriorMessage[] = [
    ...(systemMsg ? [{ role: "system" as const, content: String(systemMsg.content) }] : []),
    ...recentMsgs.map((m: Message) => ({
      role: m.role as PriorMessage["role"],
      content: m.content,
    })),
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const { buffer, format } = await ensureCompatibleFormat(audioBuffer);

  const controller = new AbortController();
  res.on("close", () => controller.abort());

  const stream = await voiceChatStream(buffer, "alloy", format, {
    signal: controller.signal,
    priorMessages,
  });

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
    await messageRepo.create({
      conversationId: id,
      role: "user",
      content: userTranscript,
    });
  }
  if (assistantTranscript) {
    await messageRepo.create({
      conversationId: id,
      role: "assistant",
      content: assistantTranscript,
    });
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
