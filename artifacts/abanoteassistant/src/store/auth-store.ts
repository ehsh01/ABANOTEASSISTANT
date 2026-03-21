import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SessionUser = {
  id: number;
  email: string;
  companyId: number;
  role: "user" | "super_admin";
};

export type SessionCompany = {
  id: number;
  name: string;
  freeUsage: boolean;
  address?: string;
  phone?: string;
  email?: string;
};

type AuthState = {
  token: string | null;
  user: SessionUser | null;
  company: SessionCompany | null;
  setSession: (token: string, user: SessionUser, company: SessionCompany) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      company: null,
      setSession: (token, user, company) => set({ token, user, company }),
      logout: () => set({ token: null, user: null, company: null }),
    }),
    { name: "aba-note-auth-v1" },
  ),
);
