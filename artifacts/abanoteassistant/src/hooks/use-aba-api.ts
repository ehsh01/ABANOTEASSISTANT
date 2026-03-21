import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ClientListResponse,
  ClientDetailResponse,
  ProgramListResponse,
  GenerateNoteRequest,
  GenerateNoteResponse,
  SaveNoteRequest,
  SaveNoteResponse,
} from "@workspace/api-client-react";
import {
  listClients,
  getClient,
  listClientPrograms,
  generateNote,
  saveNote,
} from "@workspace/api-client-react";
import { useAuthStore } from "@/store/auth-store";

export function useClients() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["/api/clients", token],
    queryFn: async (): Promise<ClientListResponse> => listClients(),
    enabled: !!token,
  });
}

export function useClient(clientId: number | undefined) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["/api/clients", clientId, token],
    enabled: !!token && clientId !== undefined && clientId !== null,
    queryFn: async (): Promise<ClientDetailResponse> => getClient(clientId!),
  });
}

export function useClientPrograms(clientId: number | undefined) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["/api/clients", clientId, "programs", token],
    enabled: !!token && clientId !== undefined && clientId !== null,
    queryFn: async (): Promise<ProgramListResponse> => listClientPrograms(clientId!),
  });
}

export function useGenerateSessionNote() {
  return useMutation({
    mutationFn: async (data: GenerateNoteRequest): Promise<GenerateNoteResponse> =>
      generateNote(data),
  });
}

export function useSaveSessionNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      noteId,
      data,
    }: {
      noteId: number;
      data: SaveNoteRequest;
    }): Promise<SaveNoteResponse> => saveNote(noteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
    },
  });
}
