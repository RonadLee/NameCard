"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SessionUser, Workspace } from "./types";

type Toast = { id: number; text: string; tone: "ok" | "err" };

type SessionState = {
  accessToken: string | null;
  user: SessionUser | null;
  workspace: Workspace | null;
  role: string | null;
  collapsed: boolean;
  toasts: Toast[];
  setSession: (input: { accessToken: string; user: SessionUser; workspace: Workspace; role?: string | null }) => void;
  setCollapsed: (collapsed: boolean) => void;
  logout: () => void;
  toast: (text: string, tone?: "ok" | "err") => void;
  dismiss: (id: number) => void;
};

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      workspace: null,
      role: null,
      collapsed: false,
      toasts: [],
      setSession: ({ accessToken, user, workspace, role }) =>
        set({
          accessToken,
          user,
          workspace,
          role: role ?? user.memberships.find((item) => item.workspace.id === workspace.id)?.role ?? null,
        }),
      setCollapsed: (collapsed) => set({ collapsed }),
      logout: () => set({ accessToken: null, user: null, workspace: null, role: null }),
      toast: (text, tone = "ok") =>
        set((state) => ({ toasts: [...state.toasts, { id: Date.now() + Math.random(), text, tone }] })),
      dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
    }),
    { name: "namecard-session", partialize: (state) => ({ accessToken: state.accessToken, user: state.user, workspace: state.workspace, role: state.role, collapsed: state.collapsed }) },
  ),
);
