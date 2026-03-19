import { create } from 'zustand';
import type { GenerateNoteRequest, GeneratedNote } from '@workspace/api-client-react';

export type WizardData = Partial<GenerateNoteRequest>;

interface WizardState {
  step: number;
  data: WizardData;
  generatedNote: GeneratedNote | null;
  // UI-only: tracks which env-change options are selected in the dropdown.
  // Stored in the wizard store (not WizardData) so Step 5 state survives
  // navigating away and back between steps.
  selectedEnvChanges: string[];
  setStep: (step: number) => void;
  updateData: (updates: Partial<WizardData>) => void;
  setGeneratedNote: (note: GeneratedNote | null) => void;
  setSelectedEnvChanges: (items: string[]) => void;
  reset: () => void;
}

const initialData: WizardData = {
  presentPeople: [],
  selectedReplacements: [],
  hasEnvironmentalChanges: false,
};

export const useWizardStore = create<WizardState>((set) => ({
  step: 1,
  data: initialData,
  generatedNote: null,
  selectedEnvChanges: [],
  setStep: (step) => set({ step }),
  updateData: (updates) => set((state) => ({ data: { ...state.data, ...updates } })),
  setGeneratedNote: (generatedNote) => set({ generatedNote }),
  setSelectedEnvChanges: (selectedEnvChanges) => set({ selectedEnvChanges }),
  reset: () => set({ step: 1, data: initialData, generatedNote: null, selectedEnvChanges: [] }),
}));
