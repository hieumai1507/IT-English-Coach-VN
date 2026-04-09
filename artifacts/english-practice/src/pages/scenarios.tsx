import React, { useState } from "react";
import { useLocation } from "wouter";
import { useListScenarios, getListScenariosQueryKey, useCreateSession } from "@workspace/api-client-react";
import { useScenarioStore } from "@/stores/useScenarioStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Mic, Briefcase, Users, Code, MessagesSquare, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLang } from "@/contexts/language";
import { SearchableSelect, type SelectOption } from "@/components/searchable-select";

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
  const { t } = useLang();
  const queryClient = useQueryClient();
  const { data: scenarios, isLoading } = useListScenarios({ query: { queryKey: getListScenariosQueryKey() } });
  const createSession = useCreateSession();
  const { 
    openCreateDialog, 
    setOpenCreateDialog, 
    newScenario, 
    setNewScenario, 
    resetNewScenario 
  } = useScenarioStore();

  const [startingId, setStartingId] = useState<string | null>(null);

  const { data: categoriesData } = useQuery({
    queryKey: ["/api/practice/categories"],
    queryFn: async () => {
      const resp = await fetch("/api/practice/categories");
      if (!resp.ok) throw new Error("Failed to load categories");
      return (await resp.json()) as Array<{ id: string; name: string }>;
    },
    enabled: openCreateDialog, // Lazy load: only fetch when dialog is open
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const resp = await fetch("/api/practice/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!resp.ok) throw new Error("Failed to create category");
      return (await resp.json()) as { id: string; name: string };
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/practice/categories"] });
    },
    onError: () => {
      toast({
        title: t.scenarios.addErrorTitle,
        description: "Could not create category. Please try again.",
        variant: "destructive",
      });
    },
  });

  const createScenarioMutation = useMutation({
    mutationFn: async (payload: typeof newScenario) => {
      const resp = await fetch("/api/practice/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) throw new Error("Failed to create scenario");
      return resp.json() as Promise<{ id: string }>;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: getListScenariosQueryKey() });
      resetNewScenario();
      setOpenCreateDialog(false);
      toast({
        title: t.scenarios.addSuccessTitle,
        description: t.scenarios.addSuccessDesc,
      });
    },
    onError: () => {
      toast({
        title: t.scenarios.addErrorTitle,
        description: t.scenarios.addErrorDesc,
        variant: "destructive",
      });
    },
  });

  const categoryOptions = React.useMemo<SelectOption[]>(() => {
    const all = new Set<string>();
    (categoriesData ?? []).forEach((c) => {
      if (c.name?.trim()) all.add(c.name.trim());
    });
    (scenarios ?? []).forEach((s) => {
      if (s.category?.trim()) all.add(s.category.trim());
    });
    return Array.from(all).map((value) => ({ value, label: value }));
  }, [scenarios, categoriesData]);

  const handleStart = (scenarioId: string) => {
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

  const handleCreateScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newScenario.name || !newScenario.description || !newScenario.systemPrompt) {
      toast({
        title: t.scenarios.requiredTitle,
        description: t.scenarios.requiredDesc,
        variant: "destructive",
      });
      return;
    }

    createScenarioMutation.mutate(newScenario);
  };

  return (
    <div className="flex-1 overflow-auto p-6 md:p-10 space-y-8 max-w-6xl mx-auto w-full animate-in">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{t.scenarios.title}</h1>
        <p className="text-muted-foreground">{t.scenarios.subtitle}</p>
      </header>

      <Dialog open={openCreateDialog} onOpenChange={setOpenCreateDialog}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            {t.scenarios.addScenario}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t.scenarios.addScenarioTitle}</DialogTitle>
            <DialogDescription>{t.scenarios.addScenarioDesc}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateScenario} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="scenario-name">{t.scenarios.name}</Label>
              <Input
                id="scenario-name"
                value={newScenario.name}
                onChange={(e) => setNewScenario({ name: e.target.value })}
                placeholder="Incident postmortem meeting"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scenario-category">{t.scenarios.category}</Label>
              <SearchableSelect
                id="scenario-category"
                value={newScenario.category}
                options={categoryOptions}
                onValueChange={(value) => setNewScenario({ category: value })}
                onCreateOption={(created) => {
                  const normalized = created.trim();
                  if (!normalized) return;
                  createCategoryMutation.mutate(normalized, {
                    onSuccess: (category) => {
                      if (!category?.name) return;
                      setNewScenario({ category: category.name });
                    },
                  });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scenario-difficulty">{t.scenarios.difficulty}</Label>
              <select
                id="scenario-difficulty"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newScenario.difficulty}
                onChange={(e) => setNewScenario({ difficulty: e.target.value })}
              >
                <option value="beginner">beginner</option>
                <option value="intermediate">intermediate</option>
                <option value="advanced">advanced</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scenario-icon">{t.scenarios.iconKey}</Label>
              <Input
                id="scenario-icon"
                value={newScenario.icon}
                onChange={(e) => setNewScenario({ icon: e.target.value })}
                placeholder="standup | code_review | interview | meeting | default"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="scenario-description">{t.scenarios.description}</Label>
              <Textarea
                id="scenario-description"
                value={newScenario.description}
                onChange={(e) => setNewScenario({ description: e.target.value })}
                placeholder="You are discussing root causes and preventive actions after an outage."
                rows={3}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="scenario-prompt">{t.scenarios.scenarioPrompt}</Label>
              <Textarea
                id="scenario-prompt"
                value={newScenario.systemPrompt}
                onChange={(e) => setNewScenario({ systemPrompt: e.target.value })}
                placeholder="Role-play as the engineering manager. Ask follow-up questions and keep context realistic."
                rows={6}
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={createScenarioMutation.isPending}>
                {createScenarioMutation.isPending ? "Adding..." : t.scenarios.addScenario}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

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
                  {startingId === scenario.id ? t.scenarios.starting : t.scenarios.startPractice}
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
