import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface WorkspaceStore {
  activeWorkspaceId: string | null; // null = "All workspaces"
  setActiveWorkspace: (id: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set) => ({
      activeWorkspaceId: null,
      setActiveWorkspace: (id) => set({ activeWorkspaceId: id }),
    }),
    {
      name: 'nr-fleet-workspace',
    },
  ),
);
