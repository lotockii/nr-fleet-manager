import { create } from 'zustand';

interface WSState {
  connected: boolean;
  setConnected: (v: boolean) => void;
}

export const useWSStore = create<WSState>((set) => ({
  connected: false,
  setConnected: (connected) => set({ connected }),
}));
