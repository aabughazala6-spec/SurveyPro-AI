import Dexie, { type Table } from 'dexie';

export type ProjectStatus = 'DRAFT' | 'IN_PROGRESS' | 'QA_VALIDATED' | 'COMPLETED';
export type DatumValidationStatus = 'VALIDATED' | 'REQUIRES_GCP_VALIDATION';

export type ProjectRecord = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt?: string;
  area: number;
  perimeter: number;
  crsCode?: string;
  // Phase 3.1 Extensions (Optional for backward compatibility)
  status?: ProjectStatus;
  datumValidationStatus?: DatumValidationStatus;
  pointCount?: number;
  lastQaqcAt?: string;
  lastQaqcScore?: number | null;
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
  // Phase 3.1 Extension: Engineering QA flag (distinct from temporary UI selection)
  flagged?: boolean;
  layer?: string;
};

export type AuditOperation =
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'IMPORT_COMPLETED'
  | 'CRS_CHANGED'
  | 'POINT_CREATED'
  | 'POINT_UPDATED'
  | 'POINT_DELETED'
  | 'BULK_POINT_UPDATE'
  | 'QAQC_RUN'
  | 'ENGINEERING_CALCULATION'
  | 'EXPORT_COMPLETED'
  | 'REPORT_GENERATED';

export type AuditSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export type AuditLogRecord = {
  id: string;
  projectId: string;
  timestamp: string;
  operation: AuditOperation;
  severity: AuditSeverity;
  summary: string;
  metadata?: Record<string, unknown>;
};

class SurveyDatabase extends Dexie {
  projects!: Table<ProjectRecord, string>;
  points!: Table<PointRecord, string>;
  auditLogs!: Table<AuditLogRecord, string>;

  constructor() {
    super('surveypro-ai');

    // Version 2: Previous baseline
    this.version(2).stores({
      projects: 'id, createdAt, name, crsCode',
      points: 'id, projectId, pointNumber, timestamp, [projectId+pointNumber]',
    });

    // Version 3: Phase 3.1 upgrade adding auditLogs and extra indexes safely
    this.version(3)
      .stores({
        projects: 'id, createdAt, name, crsCode, status',
        points: 'id, projectId, pointNumber, timestamp, [projectId+pointNumber], [projectId+flagged]',
        auditLogs: 'id, projectId, timestamp, operation, severity, [projectId+timestamp]',
      })
      .upgrade((tx) => {
        // Upgrade transformer: ensure existing projects have default statuses non-destructively
        return tx
          .table('projects')
          .toCollection()
          .modify((project: ProjectRecord) => {
            if (!project.status) {
              project.status = 'IN_PROGRESS';
            }
            if (!project.datumValidationStatus) {
              // Default to conservative check
              project.datumValidationStatus = project.crsCode?.startsWith('EPSG:20') || project.crsCode?.startsWith('EPSG:22')
                ? 'REQUIRES_GCP_VALIDATION'
                : 'VALIDATED';
            }
          });
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
  status: 'IN_PROGRESS',
  datumValidationStatus: 'VALIDATED', // UTM Zone 38N on WGS84 is authoritative
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
