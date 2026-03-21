import { create } from "zustand";

/**
 * Legacy hook: clients now live in Postgres via `/api/clients`.
 * `reset` remains so logout can clear any future client-side caches.
 */
interface ClientsState {
  reset: () => void;
}

export const useClientsStore = create<ClientsState>(() => ({
  reset: () => {},
}));
