import React from "react";
import { useParams, Link } from "wouter";
import { useGetSession, getGetSessionQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Star, Clock, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { useLang } from "@/contexts/language";

export default function SessionDetail() {
  const { t } = useLang();
  const { id: sessionId } = useParams<{ id: string }>();

  const { data: session, isLoading } = useGetSession(sessionId ?? "", {
    query: {
      enabled: !!sessionId,
      queryKey: getGetSessionQueryKey(sessionId ?? ""),
    },
  });

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-6 md:p-10 max-w-4xl mx-auto w-full">
        <Skeleton className="h-8 w-64 mb-4" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <h2 className="text-xl font-semibold">{t.practice.sessionNotFound}</h2>
        <Link href="/history">
          <Button>{t.session.backToHistory}</Button>
        </Link>
      </div>
    );
  }

  const visibleMessages = (session.messages ?? []).filter((m) => m.role !== "system");

  return (
    <div className="flex-1 overflow-auto p-6 md:p-10 max-w-4xl mx-auto w-full">
      <div className="mb-6">
        <Link href="/history">
          <Button variant="ghost" size="sm" className="gap-1 mb-4">
            <ChevronLeft className="h-4 w-4" />
            {t.session.backToHistory}
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">{session.scenarioName}</h1>
        <div className="flex items-center gap-3 mt-2">
          <Badge variant="secondary">{session.scenario?.category}</Badge>
          <Badge variant="outline">{session.scenario?.difficulty}</Badge>
          {session.durationSeconds && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {Math.ceil(session.durationSeconds / 60)} min
            </span>
          )}
          <span className="text-sm text-muted-foreground">
            {format(new Date(session.createdAt), "MMM d, yyyy 'at' h:mm a")}
          </span>
        </div>
      </div>

      {/* Score and Feedback */}
      {session.score !== null && (
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                {t.session.aiFeedback}
              </span>
              <span className="text-2xl font-bold text-primary">
                {session.score}<span className="text-sm text-muted-foreground font-normal">/100</span>
              </span>
            </CardTitle>
          </CardHeader>
          {session.feedback && (
            <CardContent>
              <p className="text-sm text-muted-foreground leading-relaxed">{session.feedback}</p>
            </CardContent>
          )}
        </Card>
      )}

      {/* Conversation */}
      <div className="mb-4 flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-semibold text-foreground">{t.session.transcript}</h2>
        <span className="text-sm text-muted-foreground">({visibleMessages.length} {t.session.messages})</span>
      </div>

      {visibleMessages.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            {t.session.noMessages}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visibleMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              }`}>
                {msg.role === "user" ? t.common.you : t.common.ai}
              </div>
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-card border border-border text-foreground rounded-tl-sm"
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 flex gap-3">
        <Link href={`/practice/${session.id}`}>
          <Button>{t.session.continuePractice}</Button>
        </Link>
        <Link href="/scenarios">
          <Button variant="secondary">{t.session.practiceAgain}</Button>
        </Link>
        <Link href="/history">
          <Button variant="outline">{t.session.backHistory}</Button>
        </Link>
      </div>
    </div>
  );
}
