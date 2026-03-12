// src/shared/stores/ui-store.ts — UI State Management
import { createStore } from 'zustand/vanilla';

export interface UIState {
  sidebarOpen: boolean;
  drawerOpen: boolean;
  commandPaletteOpen: boolean;
  activeView: 'chat' | 'sessions' | 'settings';
}

export interface UIActions {
  toggleSidebar: () => void;
  toggleDrawer: () => void;
  toggleCommandPalette: () => void;
  setActiveView: (view: UIState['activeView']) => void;
  openSidebar: () => void;
  closeSidebar: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
}

export type UIStore = UIState & UIActions;

export const createUIStore = () =>
  createStore<UIStore>((set) => ({
    sidebarOpen: true,
    drawerOpen: false,
    commandPaletteOpen: false,
    activeView: 'chat',

    toggleSidebar: () =>
      set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    toggleDrawer: () =>
      set((state) => ({ drawerOpen: !state.drawerOpen })),
    toggleCommandPalette: () =>
      set((state) => ({ commandPaletteOpen: !state.commandPaletteOpen })),
    setActiveView: (view) => set({ activeView: view }),
    openSidebar: () => set({ sidebarOpen: true }),
    closeSidebar: () => set({ sidebarOpen: false }),
    openDrawer: () => set({ drawerOpen: true }),
    closeDrawer: () => set({ drawerOpen: false }),
    openCommandPalette: () => set({ commandPaletteOpen: true }),
    closeCommandPalette: () => set({ commandPaletteOpen: false }),
  }));
