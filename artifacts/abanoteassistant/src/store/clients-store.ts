import { create } from "zustand";

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  hasAssessment: boolean;
  assessmentStatus: "ready" | "processing" | "uploaded" | "missing";
  assessmentFileName?: string;
  maladaptiveBehaviors: string[];
  replacementPrograms: string[];
  interventions: string[];
  createdAt: string;
}

interface ClientsState {
  clients: Client[];
  addClient: (client: Client) => void;
  /** Clear local client list (e.g. on logout). */
  reset: () => void;
}

export const useClientsStore = create<ClientsState>((set) => ({
  clients: [],
  addClient: (client) =>
    set((state) => ({ clients: [client, ...state.clients] })),
  reset: () => set({ clients: [] }),
}));
