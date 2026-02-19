import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  sidebarCollapsed: boolean;
  sidebarMobileOpen: boolean;
  wideMode: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setSidebarMobileOpen: (open: boolean) => void;
  setWideMode: (wide: boolean) => void;
  resetInterfacePrefs: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      sidebarMobileOpen: false,
      wideMode: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setSidebarMobileOpen: (open) => set({ sidebarMobileOpen: open }),
      setWideMode: (wide) => set({ wideMode: wide }),
      resetInterfacePrefs: () => set({ sidebarCollapsed: false, wideMode: false }),
    }),
    {
      name: 'quote-calculator-ui-store',
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        wideMode: state.wideMode,
      }),
    }
  )
);
