import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { 
  ClientListResponse, 
  ClientDetailResponse, 
  ProgramListResponse,
  GenerateNoteRequest,
  GenerateNoteResponse,
  SaveNoteRequest,
  SaveNoteResponse
} from "@workspace/api-client-react";
import { generateId } from "@/lib/utils";

// ============================================================================
// MOCK DATA
// ============================================================================
const MOCK_CLIENTS = [
  { id: "c1", name: "James R.", ageBand: "6-10 yrs", hasAssessment: true, assessmentStatus: "ready" as const },
  { id: "c2", name: "Sophia M.", ageBand: "3-5 yrs", hasAssessment: false, assessmentStatus: "missing" as const },
  { id: "c3", name: "Ethan T.", ageBand: "11-14 yrs", hasAssessment: true, assessmentStatus: "processing" as const },
  { id: "c4", name: "Olivia W.", ageBand: "6-10 yrs", hasAssessment: true, assessmentStatus: "uploaded" as const },
];

const MOCK_PROGRAMS = [
  { id: "p1", name: "Mand for desired items", type: "primary" as const, description: "Client will mand for items using 2+ words" },
  { id: "p2", name: "Tolerate denied access", type: "primary" as const, description: "Accept 'no' without maladaptive behavior" },
  { id: "p3", name: "Functional Play", type: "primary" as const },
  { id: "p4", name: "Peer interactions", type: "supplemental" as const },
  { id: "p5", name: "Transition between activities", type: "primary" as const },
  { id: "p6", name: "Expressive labeling", type: "supplemental" as const },
  { id: "p7", name: "Independent living skills", type: "primary" as const },
  { id: "p8", name: "Safety awareness", type: "supplemental" as const },
];

// Helper to simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================================
// WRAPPER HOOKS (Simulating backend until it's wired)
// ============================================================================

export function useClients() {
  return useQuery({
    queryKey: ['/api/clients'],
    queryFn: async (): Promise<ClientListResponse> => {
      await delay(600);
      return { success: true, data: MOCK_CLIENTS };
    }
  });
}

export function useClient(clientId: string) {
  return useQuery({
    queryKey: ['/api/clients', clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<ClientDetailResponse> => {
      await delay(400);
      const client = MOCK_CLIENTS.find(c => c.id === clientId);
      if (!client) throw new Error("Client not found");
      return { success: true, data: client };
    }
  });
}

export function useClientPrograms(clientId: string) {
  return useQuery({
    queryKey: ['/api/clients', clientId, 'programs'],
    enabled: !!clientId,
    queryFn: async (): Promise<ProgramListResponse> => {
      await delay(500);
      return { 
        success: true, 
        data: MOCK_PROGRAMS,
        minimumRequired: 3 // Mock dynamic requirement based on hours/client
      };
    }
  });
}

export function useGenerateSessionNote() {
  return useMutation({
    mutationFn: async (data: GenerateNoteRequest): Promise<GenerateNoteResponse> => {
      // Simulate complex AI generation
      await delay(3500);
      
      const client = MOCK_CLIENTS.find(c => c.id === data.clientId) || { name: "Unknown Client" };
      
      const peopleStr = data.presentPeople.length > 0 ? data.presentPeople.join(", ") : "therapist only";
      const programsStr = data.selectedReplacements.join(", ");
      
      const content = `Session Note: ${client.name}
Date: ${data.sessionDate} | Duration: ${data.sessionHours} hours
Present: ${peopleStr}

**Environmental Status:**
${data.hasEnvironmentalChanges ? data.environmentalChanges : "No significant environmental changes noted during this session."}

**Session Summary:**
During the ${data.sessionHours}-hour session, the client engaged in various therapeutic activities. The primary focus was on the following replacement programs: ${programsStr}. The client demonstrated moderate progress across targets, responding well to token economy reinforcement. 

**Behavioral Observations:**
Instances of maladaptive behaviors were managed proactively using redirection and providing choices. The client successfully engaged in functional play and tolerated denied access to preferred items with minimal prompting.

**Next Steps:**
Continue current program trajectory. ${data.nextSessionDate ? `Next session scheduled for ${data.nextSessionDate}.` : 'Next session to be determined.'}
      `;

      return {
        success: true,
        data: {
          noteId: `note_${generateId()}`,
          content,
          clientId: data.clientId,
          clientName: client.name,
          sessionDate: data.sessionDate,
          sessionHours: data.sessionHours,
          generatedAt: new Date().toISOString(),
        },
        warnings: data.sessionHours > 6 ? ["Long session duration noted. Ensure all data points reflect sustained engagement."] : undefined
      };
    }
  });
}

export function useSaveSessionNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ noteId, data }: { noteId: string, data: SaveNoteRequest }): Promise<SaveNoteResponse> => {
      await delay(800);
      return {
        success: true,
        data: { noteId, status: data.status }
      };
    },
    onSuccess: () => {
      // In a real app, we'd invalidate the notes list cache here
      queryClient.invalidateQueries({ queryKey: ['/api/notes'] });
    }
  });
}
