import Dexie, { type Table } from 'dexie';

export type ProjectRecord = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  area: number;
  perimeter: number;
};

export type PointRecord = {
  id: string;
  projectId: string;
  pointNumber: number;
  northing: number;
  easting: number;
  elevation: number;
  description: string;
  timestamp: string;
};

class SurveyDatabase extends Dexie {
  projects!: Table<ProjectRecord, string>;
  points!: Table<PointRecord, string>;

  constructor() {
    super('surveypro-ai');
    this.version(1).stores({
      projects: 'id, createdAt, name',
      points: 'id, projectId, pointNumber, timestamp',
    });
  }
}

export const db = new SurveyDatabase();

export const DEFAULT_PROJECT: ProjectRecord = {
  id: 'project-1',
  name: 'مخطط أرض النخيل',
  description: 'مشروع الرفع المساحي الرئيسي',
  createdAt: new Date().toISOString(),
  area: 12450.75,
  perimeter: 512.3,
};

export async function ensureDefaultProject(): Promise<void> {
  const project = await db.projects.get(DEFAULT_PROJECT.id);
  if (!project) {
    await db.projects.add(DEFAULT_PROJECT);
  }
}
