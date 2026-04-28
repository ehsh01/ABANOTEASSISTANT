import { create } from 'zustand';
import type { GenerateNoteRequest, GeneratedNote } from '@workspace/api-client-react';

export type WizardData = Partial<GenerateNoteRequest>;

interface WizardState {
  step: number;
  data: WizardData;
  generatedNote: GeneratedNote | null;
  /** Server warnings from successful POST /notes/generate (e.g. compliance hints). */
  generateWarnings: string[] | undefined;
  // UI-only: tracks which env-change options are selected in the dropdown.
  // Stored in the wizard store (not WizardData) so Step 5 state survives
  // navigating away and back between steps.
  selectedEnvChanges: string[];
  /** UI-only: maps program id → trial percentage (10–100) chosen by the therapist. */
  programTrialPercentages: Record<number, number>;
  setStep: (step: number) => void;
  updateData: (updates: Partial<WizardData>) => void;
  setGeneratedNote: (note: GeneratedNote | null, warnings?: string[]) => void;
  setSelectedEnvChanges: (items: string[]) => void;
  setProgramTrialPercentage: (programId: number, pct: number) => void;
  clearProgramTrialPercentage: (programId: number) => void;
  /** Clears wizard form only; keeps last generatedNote until a new generate succeeds. */
  resetWizardForm: () => void;
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
  generateWarnings: undefined,
  selectedEnvChanges: [],
  programTrialPercentages: {},
  setStep: (step) => set({ step }),
  updateData: (updates) => set((state) => ({ data: { ...state.data, ...updates } })),
  setGeneratedNote: (generatedNote, warnings) =>
    set({
      generatedNote,
      generateWarnings: generatedNote ? warnings : undefined,
    }),
  setSelectedEnvChanges: (selectedEnvChanges) => set({ selectedEnvChanges }),
  setProgramTrialPercentage: (programId, pct) =>
    set((state) => ({
      programTrialPercentages: { ...state.programTrialPercentages, [programId]: pct },
    })),
  clearProgramTrialPercentage: (programId) =>
    set((state) => {
      const next = { ...state.programTrialPercentages };
      delete next[programId];
      return { programTrialPercentages: next };
    }),
  resetWizardForm: () =>
    set({
      step: 1,
      data: initialData,
      generateWarnings: undefined,
      selectedEnvChanges: [],
      programTrialPercentages: {},
    }),
  reset: () =>
    set({
      step: 1,
      data: initialData,
      generatedNote: null,
      generateWarnings: undefined,
      selectedEnvChanges: [],
      programTrialPercentages: {},
    }),
}));
