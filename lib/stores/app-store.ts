'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_PROJECT, type ProjectRecord } from '@/lib/db';

type AppState = {
  isOnline: boolean;
  currentProjectId: string;
  currentProject: ProjectRecord;
  activeCrs: string;
  selectedPointId: string | null;
  setOnline: (isOnline: boolean) => void;
  setCurrentProject: (project: ProjectRecord) => void;
  setCurrentProjectId: (id: string) => void;
  setActiveCrs: (crs: string) => void;
  setSelectedPointId: (id: string | null) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isOnline: true,
      currentProjectId: DEFAULT_PROJECT.id,
      currentProject: DEFAULT_PROJECT,
      activeCrs: DEFAULT_PROJECT.crsCode || 'EPSG:32638',
      selectedPointId: null,
      setOnline: (isOnline: boolean) => set({ isOnline }),
      setCurrentProject: (project: ProjectRecord) =>
        set({
          currentProject: project,
          currentProjectId: project.id,
          activeCrs: project.crsCode || 'EPSG:32638',
        }),
      setCurrentProjectId: (id: string) => set({ currentProjectId: id }),
      setActiveCrs: (activeCrs: string) => set({ activeCrs }),
      setSelectedPointId: (selectedPointId: string | null) => set({ selectedPointId }),
    }),
    {
      name: 'surveypro-app-storage',
      partialize: (state) => ({
        currentProjectId: state.currentProjectId,
        activeCrs: state.activeCrs,
      }),
    }
  )
);
