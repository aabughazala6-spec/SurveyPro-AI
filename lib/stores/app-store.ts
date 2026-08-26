'use client';

import { create } from 'zustand';

export type Project = {
  id: string;
  name: string;
  location: string;
  areaSquareMeters: number;
  pointCount: number;
  perimeter: number;
  updatedAt: string;
};

type AppState = {
  isOnline: boolean;
  currentProject: Project;
  setOnline: (isOnline: boolean) => void;
  setCurrentProject: (project: Project) => void;
};

const defaultProject: Project = {
  id: 'project-1',
  name: 'مخطط أرض النخيل',
  location: 'الرياض، المملكة العربية السعودية',
  areaSquareMeters: 12450.75,
  pointCount: 48,
  perimeter: 512.3,
  updatedAt: 'منذ 12 دقيقة',
};

export const useAppStore = create<AppState>((set) => ({
  isOnline: true,
  currentProject: defaultProject,
  setOnline: (isOnline: boolean) => set({ isOnline }),
  setCurrentProject: (project: Project) => set({ currentProject: project }),
}));
