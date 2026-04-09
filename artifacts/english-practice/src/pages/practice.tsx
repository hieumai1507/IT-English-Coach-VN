import React, { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useVoiceRecorder, useVoiceStream } from "@workspace/integrations-openai-ai-react";
import {
  useGetSession,
  getGetSessionQueryKey,
  useGenerateFeedback,
  getListSessionsQueryKey,
  getGetPracticeStatsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { Mic, MicOff, Square, MessageCircle, Loader2, ChevronLeft, Star } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

interface Message {
  role: string;
  content: string;
  createdAt: string;
}

function useTimer() {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = () => {
    setRunning(true);
    intervalRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
  };

  const stop = () => {
    setRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);
  return { seconds, running, start, stop, formatTime };
}

export default function Practice() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [convId, setConvId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [feedback, setFeedback] = useState<{ feedback: string; score: number; suggestions: string[] } | null>(null);
  const [started, setStarted] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [streamTranscript, setStreamTranscript] = useState("");
  const [voiceStreaming, setVoiceStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timer = useTimer();

  const { data: session, isLoading } = useGetSession(sessionId ?? "", {
    query: {
      enabled: !!sessionId,
      queryKey: getGetSessionQueryKey(sessionId ?? ""),
    },
  });

  const generateFeedback = useGenerateFeedback();

  const workletPath = import.meta.env.BASE_URL + "audio-playback-worklet.js";
  const voiceStream = useVoiceStream({
    workletPath,
    onTranscript: (_partial, full) => {
      setAiTyping(false);
      setStreamTranscript(full);
    },
    onComplete: () => {
      setStreamTranscript("");
    },
    onError: (err) => {
      console.error("Voice stream error:", err);
      setAiTyping(false);
      setStreamTranscript("");
    },
  });

  const recorder = useVoiceRecorder();

  useEffect(() => {
    if (session) {
      setConvId(session.conversationId);
      setMessages(
        (session.messages ?? []).filter((m: Message) => m.role !== "system")
      );
    }
  }, [session]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamTranscript]);

  const handleStartRecording = async () => {
    setMicError(null);
    try {
      await recorder.startRecording();
      if (!started) {
        setStarted(true);
        timer.start();
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (msg.includes("Permission") || msg.includes("permission") || msg.includes("dismissed") || msg.includes("denied") || msg.includes("NotAllowed")) {
        setMicError("Microphone access was denied. Please allow microphone access in your browser and try again. If you're in an embedded preview, open the app in a new tab.");
      } else if (msg.includes("device") || msg.includes("NotFound")) {
        setMicError("No microphone found. Please connect a microphone and try again.");
      } else {
        setMicError("Could not access microphone: " + msg);
      }
    }
  };

  const handleStopRecording = async () => {
    let blob: Blob | null = null;
    try {
      blob = await recorder.stopRecording();
    } catch (err: any) {
      setAiTyping(false);
      return;
    }
    if (!blob || blob.size < 100) {
      setAiTyping(false);
      return;
    }

    setAiTyping(true);
    setVoiceStreaming(true);

    try {
      await voiceStream.streamVoiceResponse(
        `/api/openai/conversations/${convId}/voice-messages`,
        blob
      );
      if (sessionId) {
        await queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey(sessionId) });
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (!micError) {
        setMicError("Voice request failed. Please check your microphone and try again.");
      }
    } finally {
      setAiTyping(false);
      setVoiceStreaming(false);
    }
  };

  const handleEndSession = async () => {
    timer.stop();
    setSessionEnded(true);

    if (sessionId) {
      try {
        const result = await generateFeedback.mutateAsync({ id: sessionId });
        setFeedback(result as { feedback: string; score: number; suggestions: string[] });
        await queryClient.invalidateQueries({ queryKey: getListSessionsQueryKey() });
        await queryClient.invalidateQueries({ queryKey: getGetPracticeStatsQueryKey() });
      } catch (err) {
        console.error("Feedback error:", err);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 gap-4">
        <h2 className="text-xl font-semibold">Session not found</h2>
        <Link href="/scenarios">
          <Button>Browse Scenarios</Button>
        </Link>
      </div>
    );
  }

  const scenario = session.scenario;
  const allMessages = [...messages];
  if (streamTranscript) {
    allMessages.push({ role: "ai-typing", content: streamTranscript, createdAt: new Date().toISOString() });
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/scenarios">
            <Button variant="ghost" size="sm" className="gap-1">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h2 className="font-semibold text-foreground">{scenario.name}</h2>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">{scenario.category}</Badge>
              <Badge variant="outline" className="text-xs">{scenario.difficulty}</Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {started && (
            <div className="text-lg font-mono font-semibold text-primary tabular-nums">
              {timer.formatTime(timer.seconds)}
            </div>
          )}
          {!sessionEnded && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleEndSession}
              disabled={generateFeedback.isPending}
            >
              {generateFeedback.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Square className="h-4 w-4 mr-1" />
              )}
              End Session
            </Button>
          )}
        </div>
      </div>

      {/* Session Ended - Feedback Panel */}
      {sessionEnded && feedback && (
        <div className="mx-6 mt-4 p-5 bg-card border border-primary/20 rounded-xl shrink-0 max-h-72 overflow-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              AI Feedback
            </h3>
            <div className="text-2xl font-bold text-primary">{feedback.score}<span className="text-sm text-muted-foreground font-normal">/100</span></div>
          </div>
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{feedback.feedback}</p>
          {feedback.suggestions.length > 0 && (
            <div>
              <p className="text-xs font-medium text-foreground mb-2">Suggestions:</p>
              <ul className="space-y-1">
                {feedback.suggestions.map((s, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-2">
                    <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <Link href={`/session/${sessionId}`}>
              <Button size="sm" variant="outline">View Full Session</Button>
            </Link>
            <Link href="/scenarios">
              <Button size="sm">Practice Again</Button>
            </Link>
          </div>
        </div>
      )}
      {sessionEnded && generateFeedback.isPending && (
        <div className="mx-6 mt-4 p-5 bg-card border border-border rounded-xl flex items-center gap-3 shrink-0">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Generating your personalized feedback...</p>
        </div>
      )}

      {/* Chat Messages */}
      <div className="flex-1 overflow-auto p-6 space-y-4">
        {!started && (
          <div className="flex flex-col items-center justify-center h-full gap-6 text-center">
            <div className="p-6 bg-card border border-border rounded-2xl max-w-lg">
              <MessageCircle className="h-8 w-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold text-foreground mb-2">Ready to practice?</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{scenario.description}</p>
            </div>
            <p className="text-sm text-muted-foreground">Press and hold the microphone to speak when you're ready</p>
          </div>
        )}

        {allMessages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"} animate-in slide-in-from-bottom-2`}
          >
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground"
            }`}>
              {msg.role === "user" ? "You" : "AI"}
            </div>
            <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-tr-sm"
                : msg.role === "ai-typing"
                ? "bg-card border border-primary/30 text-foreground rounded-tl-sm"
                : "bg-card border border-border text-foreground rounded-tl-sm"
            }`}>
              {msg.content}
              {msg.role === "ai-typing" && (
                <span className="inline-block ml-1 animate-pulse">|</span>
              )}
            </div>
          </div>
        ))}

        {aiTyping && !streamTranscript && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-xs font-semibold shrink-0">AI</div>
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1 items-center h-4">
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Recording Controls */}
      {!sessionEnded && (
        <div className="border-t border-border bg-card p-6 shrink-0 flex flex-col items-center gap-3">
          {micError && (
            <div className="w-full max-w-md bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3 text-sm text-destructive flex flex-col gap-2">
              <p className="font-medium">Microphone error</p>
              <p className="leading-relaxed text-xs">{micError}</p>
              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline font-medium text-primary mt-1"
                onClick={() => setMicError(null)}
              >
                Open in new tab to allow microphone access →
              </a>
            </div>
          )}
          <button
            onMouseDown={handleStartRecording}
            onMouseUp={handleStopRecording}
            onTouchStart={handleStartRecording}
            onTouchEnd={handleStopRecording}
            disabled={voiceStreaming || aiTyping}
            className={`
              w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 shadow-lg
              ${recorder.state === "recording"
                ? "bg-red-500 text-white scale-110 shadow-red-500/40 shadow-xl"
                : voiceStreaming || aiTyping
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:scale-105 hover:shadow-primary/30 hover:shadow-xl active:scale-95"
              }
              ${recorder.state === "recording" ? "animate-pulse" : ""}
            `}
          >
            {recorder.state === "recording" ? (
              <MicOff className="h-8 w-8" />
            ) : voiceStreaming || aiTyping ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <Mic className="h-8 w-8" />
            )}
          </button>
          <p className="text-xs text-muted-foreground">
            {recorder.state === "recording"
              ? "Release to send your message"
              : voiceStreaming || aiTyping
              ? "AI is responding..."
              : "Hold to speak"}
          </p>
        </div>
      )}
    </div>
  );
}
