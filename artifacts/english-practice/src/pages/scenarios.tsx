import React, { useState } from "react";
import { useLocation } from "wouter";
import { useListScenarios, getListScenariosQueryKey, useCreateSession } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Mic, Briefcase, Users, Code, MessagesSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ICON_MAP: Record<string, React.ReactNode> = {
  standup: <Users className="h-5 w-5" />,
  code_review: <Code className="h-5 w-5" />,
  interview: <Briefcase className="h-5 w-5" />,
  meeting: <MessagesSquare className="h-5 w-5" />,
  default: <Mic className="h-5 w-5" />
};

export default function Scenarios() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: scenarios, isLoading } = useListScenarios({ query: { queryKey: getListScenariosQueryKey() } });
  const createSession = useCreateSession();
  const [startingId, setStartingId] = useState<number | null>(null);

  const handleStart = (scenarioId: number) => {
    setStartingId(scenarioId);
    createSession.mutate({ data: { scenarioId } }, {
      onSuccess: (data) => {
        setLocation(`/practice/${data.id}`);
      },
      onError: (err) => {
        setStartingId(null);
        toast({
          title: "Error starting session",
          description: "Could not create practice session. Please try again.",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="flex-1 overflow-auto p-6 md:p-10 space-y-8 max-w-6xl mx-auto w-full animate-in">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Practice Scenarios</h1>
        <p className="text-muted-foreground">Select a real-world IT situation to practice your English.</p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 delay-100 animate-in">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => (
            <Card key={i} className="flex flex-col">
              <CardHeader className="space-y-2">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent className="flex-1">
                <Skeleton className="h-16 w-full" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          ))
        ) : (
          scenarios?.map((scenario) => (
            <Card key={scenario.id} className="flex flex-col hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="mb-4 h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  {ICON_MAP[scenario.icon || 'default'] || ICON_MAP.default}
                </div>
                <CardTitle className="text-lg">{scenario.name}</CardTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="capitalize">{scenario.category.replace('_', ' ')}</Badge>
                  <Badge variant="outline" className={
                    scenario.difficulty === 'beginner' ? 'text-green-500 border-green-200' : 
                    scenario.difficulty === 'intermediate' ? 'text-amber-500 border-amber-200' : 
                    'text-red-500 border-red-200'
                  }>
                    {scenario.difficulty}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm text-muted-foreground line-clamp-3">{scenario.description}</p>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  onClick={() => handleStart(scenario.id)}
                  disabled={startingId === scenario.id || createSession.isPending}
                >
                  {startingId === scenario.id ? "Starting..." : "Start Practice"}
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
