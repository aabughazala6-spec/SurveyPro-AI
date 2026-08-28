'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_PROJECT, type ProjectRecord } from '@/lib/db';

export type MapInteractionMode =
  | 'view'
  | 'measure_distance'
  | 'measure_azimuth'
  | 'measure_area'
  | 'add_point';

export type SupportedLanguage = 'ar' | 'en';

type AppState = {
  isOnline: boolean;
  language: SupportedLanguage;
  currentProjectId: string;
  currentProject: ProjectRecord;
  activeCrs: string;
  selectedPointId: string | null;
  selectedPointIds: string[];
  focusedPointId: string | null;
  mapMode: MapInteractionMode;
  setOnline: (isOnline: boolean) => void;
  setLanguage: (language: SupportedLanguage) => void;
  setCurrentProject: (project: ProjectRecord) => void;
  setCurrentProjectId: (id: string) => void;
  setActiveCrs: (crs: string) => void;
  setSelectedPointId: (id: string | null) => void;
  setSelectedPointIds: (ids: string[]) => void;
  toggleSelectPointId: (id: string) => void;
  setFocusedPointId: (id: string | null) => void;
  setMapMode: (mode: MapInteractionMode) => void;
  clearSelection: () => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isOnline: true,
      language: 'ar',
      currentProjectId: DEFAULT_PROJECT.id,
      currentProject: DEFAULT_PROJECT,
      activeCrs: DEFAULT_PROJECT.crsCode || 'EPSG:32638',
      selectedPointId: null,
      selectedPointIds: [],
      focusedPointId: null,
      mapMode: 'view',
      setOnline: (isOnline: boolean) => set({ isOnline }),
      setLanguage: (language: SupportedLanguage) => set({ language }),
      setCurrentProject: (project: ProjectRecord) =>
        set({
          currentProject: project,
          currentProjectId: project.id,
          activeCrs: project.crsCode || 'EPSG:32638',
        }),
      setCurrentProjectId: (id: string) => set({ currentProjectId: id }),
      setActiveCrs: (activeCrs: string) => set({ activeCrs }),
      setSelectedPointId: (selectedPointId: string | null) =>
        set((state) => ({
          selectedPointId,
          selectedPointIds: selectedPointId ? [selectedPointId] : [],
        })),
      setSelectedPointIds: (selectedPointIds: string[]) =>
        set({
          selectedPointIds,
          selectedPointId: selectedPointIds.length > 0 ? selectedPointIds[0] : null,
        }),
      toggleSelectPointId: (id: string) =>
        set((state) => {
          const exists = state.selectedPointIds.includes(id);
          const next = exists
            ? state.selectedPointIds.filter((x) => x !== id)
            : [...state.selectedPointIds, id];
          return {
            selectedPointIds: next,
            selectedPointId: next.length > 0 ? next[next.length - 1] : null,
          };
        }),
      setFocusedPointId: (focusedPointId: string | null) => set({ focusedPointId }),
      setMapMode: (mapMode: MapInteractionMode) => set({ mapMode }),
      clearSelection: () => set({ selectedPointId: null, selectedPointIds: [], focusedPointId: null }),
    }),
    {
      name: 'surveypro-app-storage',
      partialize: (state) => ({
        language: state.language,
        currentProjectId: state.currentProjectId,
        activeCrs: state.activeCrs,
      }),
    }
  )
);
