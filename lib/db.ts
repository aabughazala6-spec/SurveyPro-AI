import Dexie, { type Table } from 'dexie';

export type ProjectRecord = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt?: string;
  area: number;
  perimeter: number;
  crsCode?: string;
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
    this.version(2).stores({
      projects: 'id, createdAt, name, crsCode',
      points: 'id, projectId, pointNumber, timestamp, [projectId+pointNumber]',
    });
  }
}

export const db = new SurveyDatabase();

export const DEFAULT_PROJECT: ProjectRecord = {
  id: 'project-1',
  name: 'مخطط أرض النخيل',
  description: 'مشروع الرفع المساحي الرئيسي - الرياض',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  area: 12450.75,
  perimeter: 512.3,
  crsCode: 'EPSG:32638',
};

// Initial realistic surveying points for default project (UTM Zone 38N - Riyadh region)
export const INITIAL_SAMPLE_POINTS: Omit<PointRecord, 'id' | 'timestamp'>[] = [
  {
    projectId: 'project-1',
    pointNumber: 1,
    easting: 673450.25,
    northing: 2736120.4,
    elevation: 648.5,
    description: 'الزاوية الشمالية الغربية - ركن حديدي',
  },
  {
    projectId: 'project-1',
    pointNumber: 2,
    easting: 673570.8,
    northing: 2736145.1,
    elevation: 649.2,
    description: 'حد الشمال - نقطة مسار',
  },
  {
    projectId: 'project-1',
    pointNumber: 3,
    easting: 673620.15,
    northing: 2736030.75,
    elevation: 651.05,
    description: 'الزاوية الشمالية الشرقية - وتد خرساني',
  },
  {
    projectId: 'project-1',
    pointNumber: 4,
    easting: 673580.4,
    northing: 2735910.6,
    elevation: 650.3,
    description: 'الزاوية الجنوبية الشرقية - منسوب شارع',
  },
  {
    projectId: 'project-1',
    pointNumber: 5,
    easting: 673420.9,
    northing: 2735960.85,
    elevation: 647.8,
    description: 'الزاوية الجنوبية الغربية - ركن سور',
  },
];

export async function ensureDefaultProject(): Promise<void> {
  try {
    const project = await db.projects.get(DEFAULT_PROJECT.id);
    if (!project) {
      await db.projects.add(DEFAULT_PROJECT);
    }
    const count = await db.points.where('projectId').equals(DEFAULT_PROJECT.id).count();
    if (count === 0) {
      const now = new Date().toISOString();
      for (const p of INITIAL_SAMPLE_POINTS) {
        await db.points.add({
          ...p,
          id: crypto.randomUUID(),
          timestamp: now,
        });
      }
    }
  } catch (error) {
    console.error('Error ensuring default project:', error);
  }
}
