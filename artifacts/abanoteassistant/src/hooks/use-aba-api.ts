import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type {
  ClientListResponse,
  ClientDetailResponse,
  ProgramListResponse,
  ListBehaviorProgramApprovalsResponse,
  ReplacementProgramListResponse,
  GenerateNoteRequest,
  GenerateNoteResponse,
  NoteListResponse,
  NoteDetailResponse,
  SaveNoteRequest,
  SaveNoteResponse,
  DeleteNoteResponse,
  DeleteClientResponse,
  DeleteClientProgramResponse,
  UpdateClientProgramBody,
  UpdateClientProgramResponse,
  PutBehaviorApprovedProgramsRequest,
  PutBehaviorApprovedProgramsResponse,
  AbcActivityAntecedentListResponse,
} from "@workspace/api-client-react";
import {
  listClients,
  getClient,
  listClientPrograms,
  listClientBehaviorProgramApprovals,
  listClientReplacementPrograms,
  putClientBehaviorApprovedPrograms,
  listNotes,
  getNote,
  generateNote,
  saveNote,
  deleteNote as deleteNoteRequest,
  deleteClient as deleteClientRequest,
  updateClientProgram,
  deleteClientProgram,
  extractAssessmentFromPdf,
  listAbcBuilderActivityAntecedents,
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

export function useClientBehaviorProgramApprovals(clientId: number | undefined) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["/api/clients", clientId, "behavior-program-approvals", token],
    enabled: !!token && clientId !== undefined && clientId !== null,
    queryFn: async (): Promise<ListBehaviorProgramApprovalsResponse> =>
      listClientBehaviorProgramApprovals(clientId!),
    placeholderData: keepPreviousData,
  });
}

export function useClientReplacementProgramsList(clientId: number | undefined) {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["/api/clients", clientId, "replacement-programs", token],
    enabled: !!token && clientId !== undefined && clientId !== null,
    queryFn: async (): Promise<ReplacementProgramListResponse> =>
      listClientReplacementPrograms(clientId!),
  });
}

export function usePutClientBehaviorApprovedPrograms() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      clientId: number;
      behaviorLabel: string;
      data: PutBehaviorApprovedProgramsRequest;
    }): Promise<PutBehaviorApprovedProgramsResponse> =>
      putClientBehaviorApprovedPrograms(
        vars.clientId,
        encodeURIComponent(vars.behaviorLabel),
        vars.data,
      ),
    onSuccess: (res, vars) => {
      const canonical = res.data.behaviorLabel.trim();
      const fresh = res.data.items;

      queryClient.setQueriesData(
        {
          predicate: (q) => {
            const k = q.queryKey;
            return (
              Array.isArray(k) &&
              k[0] === "/api/clients" &&
              k[1] === vars.clientId &&
              k[2] === "behavior-program-approvals"
            );
          },
        },
        (old: ListBehaviorProgramApprovalsResponse | undefined) => {
          if (old == null) {
            return {
              success: true,
              data: { items: [...fresh] },
              error: null,
            };
          }
          if (!Array.isArray(old.data?.items)) {
            return old;
          }
          const cl = canonical.toLowerCase();
          const rest = old.data.items.filter((row) => {
            const rl = row.behaviorLabel.trim().toLowerCase();
            return rl !== cl;
          });
          return {
            ...old,
            data: {
              items: [...rest, ...fresh],
            },
          };
        },
      );

      queryClient.invalidateQueries({
        queryKey: ["/api/clients", vars.clientId, "behavior-program-approvals"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", vars.clientId] });
    },
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

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (clientId: number): Promise<DeleteClientResponse> =>
      deleteClientRequest(clientId),
    onSuccess: (_res, clientId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.removeQueries({ queryKey: ["/api/clients", clientId] });
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
    },
  });
}

export function useUpdateClientProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      clientId: number;
      programId: number;
      data: UpdateClientProgramBody;
    }): Promise<UpdateClientProgramResponse> =>
      updateClientProgram(vars.clientId, vars.programId, vars.data),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", vars.clientId, "programs"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", vars.clientId, "replacement-programs"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", vars.clientId, "behavior-program-approvals"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", vars.clientId] });
    },
  });
}

export function useDeleteClientProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: {
      clientId: number;
      programId: number;
    }): Promise<DeleteClientProgramResponse> =>
      deleteClientProgram(vars.clientId, vars.programId),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", vars.clientId, "programs"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", vars.clientId, "replacement-programs"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/clients", vars.clientId, "behavior-program-approvals"],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", vars.clientId] });
    },
  });
}

export function useExtractAssessmentFromPdf() {
  return useMutation({
    mutationFn: async (file: File): Promise<AssessmentExtractSuccessResponse> =>
      extractAssessmentFromPdf(file),
  });
}

export function useAbcActivityAntecedents() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["/api/notes/abc-builder/activity-antecedents", token],
    queryFn: async (): Promise<AbcActivityAntecedentListResponse> =>
      listAbcBuilderActivityAntecedents(),
    enabled: !!token,
    staleTime: 1000 * 60 * 10,
  });
}
