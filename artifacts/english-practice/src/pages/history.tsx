import React from "react";
import { Link } from "wouter";
import { useListSessions, getListSessionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Star, ChevronRight, Mic2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function History() {
  const { data: sessions, isLoading } = useListSessions({
    query: { queryKey: getListSessionsQueryKey() },
  });

  return (
    <div className="flex-1 overflow-auto p-6 md:p-10 max-w-4xl mx-auto w-full">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Practice History</h1>
        <p className="text-muted-foreground mt-1">Review your past sessions and track your progress.</p>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="h-5 w-48 mb-2" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !sessions || sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
          <Mic2 className="h-12 w-12 text-muted-foreground/40" />
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No sessions yet</h3>
            <p className="text-muted-foreground text-sm">Start your first practice session to see your history here.</p>
          </div>
          <Link href="/scenarios">
            <Button>Start Practicing</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Link key={session.id} href={`/session/${session.id}`}>
              <Card className="hover:border-primary/40 transition-all cursor-pointer group">
                <CardContent className="p-5 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <h3 className="font-semibold text-foreground truncate">{session.scenarioName}</h3>
                      {session.score !== null && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Star className="h-3.5 w-3.5 text-yellow-500" />
                          <span className="text-sm font-semibold text-foreground">{session.score}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {session.durationSeconds && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {Math.ceil(session.durationSeconds / 60)} min
                        </span>
                      )}
                      <span>
                        {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    {session.feedback && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                        {session.feedback}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0 ml-4" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
