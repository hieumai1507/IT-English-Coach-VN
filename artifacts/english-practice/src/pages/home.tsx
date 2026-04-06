import React from "react";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGetPracticeStats, getGetPracticeStatsQueryKey } from "@workspace/api-client-react";
import { Clock, TrendingUp, CheckCircle, Plus, Mic2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

export default function Home() {
  const { data: stats, isLoading } = useGetPracticeStats({ query: { queryKey: getGetPracticeStatsQueryKey() } });

  return (
    <div className="flex-1 overflow-auto p-6 md:p-10 space-y-8 max-w-6xl mx-auto w-full animate-in">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back. Ready to sharpen your professional English?</p>
      </header>

      <div className="grid gap-6 md:grid-cols-3 delay-100 animate-in">
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : <div className="text-3xl font-bold">{stats?.totalSessions || 0}</div>}
          </CardContent>
        </Card>
        
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Practice Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : <div className="text-3xl font-bold">{stats?.totalMinutes || 0} <span className="text-lg font-normal text-muted-foreground">min</span></div>}
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Score</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : <div className="text-3xl font-bold text-primary">{stats?.averageScore ? Math.round(stats.averageScore) : 0}<span className="text-lg font-normal text-muted-foreground">/100</span></div>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 md:grid-cols-2 delay-200 animate-in">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold tracking-tight">Recent Sessions</h2>
            <Link href="/history">
              <Button variant="link" className="text-primary px-0">View all</Button>
            </Link>
          </div>
          
          <div className="space-y-4">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
            ) : !stats?.recentSessions?.length ? (
              <Card className="bg-secondary/50 border-dashed">
                <CardContent className="flex flex-col items-center justify-center h-40 text-center space-y-3">
                  <Mic2 className="h-8 w-8 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No practice sessions yet. Start your first scenario!</p>
                  <Link href="/scenarios">
                    <Button size="sm">Browse Scenarios</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              stats.recentSessions.map(session => (
                <Link key={session.id} href={`/session/${session.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <div className="font-medium group-hover:text-primary transition-colors">{session.scenarioName}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(session.createdAt), { addSuffix: true })} • {Math.round((session.durationSeconds || 0)/60)} min
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {session.score && (
                          <div className="flex items-center text-sm font-medium text-amber-500 bg-amber-500/10 px-2 py-1 rounded-md">
                            <Star className="h-3 w-3 mr-1" fill="currentColor" />
                            {session.score}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4 delay-300 animate-in">
          <h2 className="text-xl font-semibold tracking-tight">Quick Start</h2>
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-primary flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Start a New Session
              </CardTitle>
              <CardDescription>
                Choose a scenario based on real-world IT situations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/scenarios">
                <Button className="w-full" size="lg">
                  Browse Scenarios
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
