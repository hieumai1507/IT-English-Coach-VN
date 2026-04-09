import { create } from "zustand";

interface ScenarioState {
  openCreateDialog: boolean;
  setOpenCreateDialog: (open: boolean) => void;
  
  // Form state for creating a new scenario
  newScenario: {
    name: string;
    description: string;
    category: string;
    difficulty: string;
    icon: string;
    systemPrompt: string;
  };
  setNewScenario: (payload: Partial<ScenarioState["newScenario"]>) => void;
  resetNewScenario: () => void;
}

export const useScenarioStore = create<ScenarioState>((set) => ({
  openCreateDialog: false,
  setOpenCreateDialog: (open) => set({ openCreateDialog: open }),
  
  newScenario: {
    name: "",
    description: "",
    category: "communication",
    difficulty: "intermediate",
    icon: "default",
    systemPrompt: "",
  },
  
  setNewScenario: (payload) => 
    set((state) => ({ 
      newScenario: { ...state.newScenario, ...payload } 
    })),
    
  resetNewScenario: () => 
    set({
      newScenario: {
        name: "",
        description: "",
        category: "communication",
        difficulty: "intermediate",
        icon: "default",
        systemPrompt: "",
      }
    }),
}));
