import { create } from 'zustand';
import type { GenerateNoteRequest, GeneratedNote } from '@workspace/api-client-react';

export type WizardData = Partial<GenerateNoteRequest>;

interface WizardState {
  step: number;
  data: WizardData;
  generatedNote: GeneratedNote | null;
  setStep: (step: number) => void;
  updateData: (updates: Partial<WizardData>) => void;
  setGeneratedNote: (note: GeneratedNote | null) => void;
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
  setStep: (step) => set({ step }),
  updateData: (updates) => set((state) => ({ data: { ...state.data, ...updates } })),
  setGeneratedNote: (generatedNote) => set({ generatedNote }),
  reset: () => set({ step: 1, data: initialData, generatedNote: null }),
}));
