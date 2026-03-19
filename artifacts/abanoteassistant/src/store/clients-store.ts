import { create } from 'zustand';

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

const INITIAL_CLIENTS: Client[] = [
  {
    id: "c1",
    firstName: "James",
    lastName: "R.",
    dateOfBirth: "03/15/2019",
    gender: "Male",
    hasAssessment: true,
    assessmentStatus: "ready",
    maladaptiveBehaviors: ["Aggression", "Self-injurious behavior"],
    replacementPrograms: ["Mand for desired items", "Functional Play"],
    interventions: ["Token economy", "Redirection"],
    createdAt: "2024-01-10T00:00:00.000Z",
  },
  {
    id: "c2",
    firstName: "Sophia",
    lastName: "M.",
    dateOfBirth: "11/22/2021",
    gender: "Female",
    hasAssessment: false,
    assessmentStatus: "missing",
    maladaptiveBehaviors: ["Elopement"],
    replacementPrograms: ["Peer interactions"],
    interventions: ["Planned ignoring"],
    createdAt: "2024-02-05T00:00:00.000Z",
  },
  {
    id: "c3",
    firstName: "Ethan",
    lastName: "T.",
    dateOfBirth: "07/08/2013",
    gender: "Male",
    hasAssessment: true,
    assessmentStatus: "processing",
    maladaptiveBehaviors: ["Tantrums", "Property destruction"],
    replacementPrograms: ["Tolerate denied access", "Transition between activities"],
    interventions: ["DRI", "Choice making"],
    createdAt: "2024-03-01T00:00:00.000Z",
  },
  {
    id: "c4",
    firstName: "Olivia",
    lastName: "W.",
    dateOfBirth: "09/30/2018",
    gender: "Female",
    hasAssessment: true,
    assessmentStatus: "uploaded",
    maladaptiveBehaviors: ["Vocal disruption"],
    replacementPrograms: ["Expressive labeling", "Independent living skills"],
    interventions: ["NCR", "FCT"],
    createdAt: "2024-03-15T00:00:00.000Z",
  },
];

interface ClientsState {
  clients: Client[];
  addClient: (client: Client) => void;
}

export const useClientsStore = create<ClientsState>((set) => ({
  clients: INITIAL_CLIENTS,
  addClient: (client) =>
    set((state) => ({ clients: [client, ...state.clients] })),
}));
