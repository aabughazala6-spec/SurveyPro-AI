/**
 * Engineering Audit Logging Service
 *
 * Provides a resilient, best-effort logging mechanism for survey operations.
 * If logging encounters an error, it fails silently to avoid interrupting
 * the primary engineering calculations or user operations.
 */

import { db, type AuditLogRecord, type AuditOperation, type AuditSeverity } from './db';

export interface LogAuditOptions {
  projectId: string;
  operation: AuditOperation;
  severity?: AuditSeverity;
  summary: string;
  metadata?: Record<string, unknown>;
}

export async function logAuditEvent({
  projectId,
  operation,
  severity = 'INFO',
  summary,
  metadata,
}: LogAuditOptions): Promise<string | null> {
  try {
    const id = crypto.randomUUID();
    const entry: AuditLogRecord = {
      id,
      projectId,
      timestamp: new Date().toISOString(),
      operation,
      severity,
      summary,
      metadata,
    };

    await db.auditLogs.add(entry);
    return id;
  } catch (err) {
    // Best-effort strategy: never crash primary engineering workflow
    console.warn('Failed to record engineering audit log:', err);
    return null;
  }
}

/**
 * Retrieve audit history for a specific project sorted descending by timestamp
 */
export async function getProjectAuditLogs(
  projectId: string,
  limit: number = 100
): Promise<AuditLogRecord[]> {
  try {
    return await db.auditLogs
      .where('projectId')
      .equals(projectId)
      .reverse()
      .sortBy('timestamp')
      .then((items) => items.slice(0, limit));
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    return [];
  }
}
