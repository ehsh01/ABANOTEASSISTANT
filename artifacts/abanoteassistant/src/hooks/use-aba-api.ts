import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ClientListResponse,
  ClientDetailResponse,
  ProgramListResponse,
  GenerateNoteRequest,
  GenerateNoteResponse,
  NoteListResponse,
  NoteDetailResponse,
  SaveNoteRequest,
  SaveNoteResponse,
  DeleteNoteResponse,
} from "@workspace/api-client-react";
import {
  listClients,
  getClient,
  listClientPrograms,
  listNotes,
  getNote,
  generateNote,
  saveNote,
  deleteNote as deleteNoteRequest,
  extractAssessmentFromPdf,
  type AssessmentExtractSuccessResponse,
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

export function useNotesList() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["/api/notes", token],
    queryFn: async (): Promise<NoteListResponse> => listNotes(),
    enabled: !!token,
  });
}

export function useNoteDetail(noteId: number | undefined) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["/api/notes", noteId, token],
    queryFn: async (): Promise<NoteDetailResponse> => getNote(noteId!),
    enabled: !!token && noteId !== undefined && !Number.isNaN(noteId),
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
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notes", vars.noteId] });
    },
  });
}

export function useDeleteSessionNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (noteId: number): Promise<DeleteNoteResponse> => deleteNoteRequest(noteId),
    onSuccess: (_res, noteId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notes", noteId] });
    },
  });
}

export function useExtractAssessmentFromPdf() {
  return useMutation({
    mutationFn: async (file: File): Promise<AssessmentExtractSuccessResponse> =>
      extractAssessmentFromPdf(file),
  });
}
