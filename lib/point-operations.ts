import { db, type PointRecord, type ProjectRecord } from './db';
import { logAuditEvent } from './audit-service';
import { transformCoordinates, SUPPORTED_CRS } from './crs-definitions';
import {
  calculatePolygonArea,
  calculatePolygonPerimeter,
} from './survey-calculations';

export interface BoundingBox3D {
  minE: number;
  maxE: number;
  deltaE: number;
  minN: number;
  maxN: number;
  deltaN: number;
  minZ: number;
  maxZ: number;
  deltaZ: number;
  avgZ: number;
}

export interface BulkShiftElevationParams {
  projectId: string;
  pointIds: string[];
  deltaZ: number;
}

export interface BulkShiftCoordinatesParams {
  projectId: string;
  pointIds: string[];
  deltaE: number;
  deltaN: number;
}

export interface BulkUpdateLayerParams {
  projectId: string;
  pointIds: string[];
  layer?: string;
  description?: string;
}

export interface BulkToggleFlagParams {
  projectId: string;
  pointIds: string[];
  flagged: boolean;
}

export interface TransformProjectCrsParams {
  projectId: string;
  sourceCrs: string;
  targetCrs: string;
  mode: 'TRANSFORM_COORDINATES' | 'ASSIGN_METADATA_ONLY';
}

/**
 * Calculates deterministic 3D bounding box and statistics for points
 */
export function calculatePointStatistics(points: PointRecord[]): {
  count: number;
  flaggedCount: number;
  bbox: BoundingBox3D;
} {
  if (!points || points.length === 0) {
    return {
      count: 0,
      flaggedCount: 0,
      bbox: {
        minE: 0,
        maxE: 0,
        deltaE: 0,
        minN: 0,
        maxN: 0,
        deltaN: 0,
        minZ: 0,
        maxZ: 0,
        deltaZ: 0,
        avgZ: 0,
      },
    };
  }

  let minE = Infinity;
  let maxE = -Infinity;
  let minN = Infinity;
  let maxN = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let sumZ = 0;
  let flaggedCount = 0;

  for (const p of points) {
    if (p.easting < minE) minE = p.easting;
    if (p.easting > maxE) maxE = p.easting;
    if (p.northing < minN) minN = p.northing;
    if (p.northing > maxN) maxN = p.northing;
    if (p.elevation < minZ) minZ = p.elevation;
    if (p.elevation > maxZ) maxZ = p.elevation;
    sumZ += p.elevation;
    if (p.flagged) flaggedCount++;
  }

  return {
    count: points.length,
    flaggedCount,
    bbox: {
      minE: Number.isFinite(minE) ? minE : 0,
      maxE: Number.isFinite(maxE) ? maxE : 0,
      deltaE: Number.isFinite(maxE - minE) ? maxE - minE : 0,
      minN: Number.isFinite(minN) ? minN : 0,
      maxN: Number.isFinite(maxN) ? maxN : 0,
      deltaN: Number.isFinite(maxN - minN) ? maxN - minN : 0,
      minZ: Number.isFinite(minZ) ? minZ : 0,
      maxZ: Number.isFinite(maxZ) ? maxZ : 0,
      deltaZ: Number.isFinite(maxZ - minZ) ? maxZ - minZ : 0,
      avgZ: points.length > 0 ? sumZ / points.length : 0,
    },
  };
}

/**
 * Recalculates and updates project summary geometry (Area, Perimeter, PointCount)
 */
export async function syncProjectGeometry(projectId: string): Promise<ProjectRecord | null> {
  const points = await db.points.where('projectId').equals(projectId).sortBy('pointNumber');
  const area = calculatePolygonArea(points);
  const perimeter = calculatePolygonPerimeter(points);
  const now = new Date().toISOString();

  await db.projects.update(projectId, {
    area,
    perimeter,
    pointCount: points.length,
    updatedAt: now,
  });

  return (await db.projects.get(projectId)) ?? null;
}

/**
 * Adds a new survey point with validation and audit trail logging
 */
export async function addSurveyPoint(
  projectId: string,
  point: {
    pointNumber: number;
    easting: number;
    northing: number;
    elevation: number;
    description?: string;
    layer?: string;
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!Number.isFinite(point.pointNumber) || point.pointNumber < 1) {
    return { success: false, error: 'رقم النقطة غير صالح' };
  }
  if (!Number.isFinite(point.easting) || !Number.isFinite(point.northing) || !Number.isFinite(point.elevation)) {
    return { success: false, error: 'يجب إدخال قيم رقمية صحيحة للإحداثيات' };
  }

  // Check duplicate point number in project
  const existing = await db.points
    .where('projectId')
    .equals(projectId)
    .and((p) => p.pointNumber === point.pointNumber)
    .first();

  if (existing) {
    return { success: false, error: `رقم النقطة P${point.pointNumber} مستخدم مسبقاً في هذا المشروع` };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const pointRecord: PointRecord = {
    id,
    projectId,
    pointNumber: point.pointNumber,
    easting: point.easting,
    northing: point.northing,
    elevation: point.elevation,
    description: point.description?.trim() || '',
    layer: point.layer?.trim() || 'SURVEY_POINTS',
    timestamp: now,
    flagged: false,
  };

  await db.transaction('rw', [db.points, db.projects, db.auditLogs], async () => {
    await db.points.add(pointRecord);
    await syncProjectGeometry(projectId);
    await logAuditEvent({
      projectId,
      operation: 'POINT_CREATED',
      severity: 'INFO',
      summary: `إضافة النقطة P${pointRecord.pointNumber} (E: ${pointRecord.easting.toFixed(3)}, N: ${pointRecord.northing.toFixed(3)}, Z: ${pointRecord.elevation.toFixed(3)})`,
      metadata: { pointId: id, pointNumber: pointRecord.pointNumber },
    });
  });

  return { success: true, id };
}

/**
 * Updates a survey point with validation and audit trail logging
 */
export async function updateSurveyPoint(
  id: string,
  updates: Partial<Omit<PointRecord, 'id' | 'projectId' | 'timestamp'>>
): Promise<{ success: boolean; error?: string }> {
  const current = await db.points.get(id);
  if (!current) {
    return { success: false, error: 'النقطة غير موجودة' };
  }

  if (updates.pointNumber !== undefined) {
    if (!Number.isFinite(updates.pointNumber) || updates.pointNumber < 1) {
      return { success: false, error: 'رقم النقطة غير صالح' };
    }
    if (updates.pointNumber !== current.pointNumber) {
      const duplicate = await db.points
        .where('projectId')
        .equals(current.projectId)
        .and((p) => p.pointNumber === updates.pointNumber && p.id !== id)
        .first();
      if (duplicate) {
        return { success: false, error: `رقم النقطة P${updates.pointNumber} مستخدم بالفعل` };
      }
    }
  }

  await db.transaction('rw', [db.points, db.projects, db.auditLogs], async () => {
    await db.points.update(id, updates);
    await syncProjectGeometry(current.projectId);
    await logAuditEvent({
      projectId: current.projectId,
      operation: 'POINT_UPDATED',
      severity: 'INFO',
      summary: `تحديث بيانات النقطة P${updates.pointNumber ?? current.pointNumber}`,
      metadata: { pointId: id, previous: current, updates },
    });
  });

  return { success: true };
}

/**
 * Deletes a single survey point with audit logging
 */
export async function deleteSurveyPoint(id: string): Promise<{ success: boolean; error?: string }> {
  const current = await db.points.get(id);
  if (!current) {
    return { success: false, error: 'النقطة غير موجودة' };
  }

  await db.transaction('rw', [db.points, db.projects, db.auditLogs], async () => {
    await db.points.delete(id);
    await syncProjectGeometry(current.projectId);
    await logAuditEvent({
      projectId: current.projectId,
      operation: 'POINT_DELETED',
      severity: 'WARNING',
      summary: `حذف النقطة P${current.pointNumber} من المشروع`,
      metadata: { deletedPoint: current },
    });
  });

  return { success: true };
}

/**
 * Bulk deletes points with an atomic transaction and audit logging
 */
export async function bulkDeletePoints(
  projectId: string,
  pointIds: string[]
): Promise<{ success: boolean; count: number; error?: string }> {
  if (!pointIds || pointIds.length === 0) {
    return { success: false, count: 0, error: 'لم يتم تحديد أي نقاط للحذف' };
  }

  try {
    await db.transaction('rw', [db.points, db.projects, db.auditLogs], async () => {
      await db.points.bulkDelete(pointIds);
      await syncProjectGeometry(projectId);
      await logAuditEvent({
        projectId,
        operation: 'POINT_DELETED',
        severity: 'WARNING',
        summary: `حذف جماعي لعدد ${pointIds.length} نقطة مساحية`,
        metadata: { deletedCount: pointIds.length, pointIds },
      });
    });

    return { success: true, count: pointIds.length };
  } catch (err) {
    return { success: false, count: 0, error: String(err) };
  }
}

/**
 * Bulk shifts elevation (ΔZ) for selected points with atomic transaction
 */
export async function bulkShiftElevation({
  projectId,
  pointIds,
  deltaZ,
}: BulkShiftElevationParams): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  if (!pointIds || pointIds.length === 0) {
    return { success: false, updatedCount: 0, error: 'لم يتم تحديد نقاط' };
  }
  if (!Number.isFinite(deltaZ) || deltaZ === 0) {
    return { success: false, updatedCount: 0, error: 'يجب إدخال قيمة إزاحة منسوب ΔZ غير صفرية' };
  }

  try {
    await db.transaction('rw', [db.points, db.projects, db.auditLogs], async () => {
      const selected = await db.points.where('id').anyOf(pointIds).toArray();
      const updates = selected.map((p) => ({
        ...p,
        elevation: p.elevation + deltaZ,
      }));

      await db.points.bulkPut(updates);
      await syncProjectGeometry(projectId);

      await logAuditEvent({
        projectId,
        operation: 'BULK_POINT_UPDATE',
        severity: 'INFO',
        summary: `إزاحة مناسيب جماعية لعدد ${updates.length} نقطة بمقدار ${deltaZ > 0 ? '+' : ''}${deltaZ.toFixed(4)} م`,
        metadata: {
          operationType: 'SHIFT_ELEVATION',
          deltaZ,
          pointCount: updates.length,
          pointIds,
        },
      });
    });

    return { success: true, updatedCount: pointIds.length };
  } catch (err) {
    return { success: false, updatedCount: 0, error: String(err) };
  }
}

/**
 * Bulk shifts planar coordinates (ΔE, ΔN) for selected points with atomic transaction
 */
export async function bulkShiftCoordinates({
  projectId,
  pointIds,
  deltaE,
  deltaN,
}: BulkShiftCoordinatesParams): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  if (!pointIds || pointIds.length === 0) {
    return { success: false, updatedCount: 0, error: 'لم يتم تحديد نقاط' };
  }
  if (!Number.isFinite(deltaE) || !Number.isFinite(deltaN) || (deltaE === 0 && deltaN === 0)) {
    return { success: false, updatedCount: 0, error: 'يجب إدخال قيم إزاحة إحداثية صالحة' };
  }

  try {
    await db.transaction('rw', [db.points, db.projects, db.auditLogs], async () => {
      const selected = await db.points.where('id').anyOf(pointIds).toArray();
      const updates = selected.map((p) => ({
        ...p,
        easting: p.easting + deltaE,
        northing: p.northing + deltaN,
      }));

      await db.points.bulkPut(updates);
      await syncProjectGeometry(projectId);

      await logAuditEvent({
        projectId,
        operation: 'BULK_POINT_UPDATE',
        severity: 'INFO',
        summary: `إزاحة إحداثيات مستوية (ΔE: ${deltaE.toFixed(3)}م, ΔN: ${deltaN.toFixed(3)}م) لعدد ${updates.length} نقطة`,
        metadata: {
          operationType: 'SHIFT_COORDINATES',
          deltaE,
          deltaN,
          pointCount: updates.length,
          pointIds,
        },
      });
    });

    return { success: true, updatedCount: pointIds.length };
  } catch (err) {
    return { success: false, updatedCount: 0, error: String(err) };
  }
}

/**
 * Bulk updates description or layer for selected points
 */
export async function bulkUpdateLayer({
  projectId,
  pointIds,
  layer,
  description,
}: BulkUpdateLayerParams): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  if (!pointIds || pointIds.length === 0) {
    return { success: false, updatedCount: 0, error: 'لم يتم تحديد نقاط' };
  }

  try {
    await db.transaction('rw', [db.points, db.projects, db.auditLogs], async () => {
      const selected = await db.points.where('id').anyOf(pointIds).toArray();
      const updates = selected.map((p) => ({
        ...p,
        layer: layer !== undefined ? layer.trim() : p.layer,
        description: description !== undefined ? description.trim() : p.description,
      }));

      await db.points.bulkPut(updates);

      await logAuditEvent({
        projectId,
        operation: 'BULK_POINT_UPDATE',
        severity: 'INFO',
        summary: `تحديث تصنيف/طبقة لعدد ${updates.length} نقطة مساحية`,
        metadata: {
          operationType: 'UPDATE_LAYER_CODE',
          layer,
          description,
          pointCount: updates.length,
        },
      });
    });

    return { success: true, updatedCount: pointIds.length };
  } catch (err) {
    return { success: false, updatedCount: 0, error: String(err) };
  }
}

/**
 * Bulk flags or unflags points for QA inspection
 */
export async function bulkToggleFlag({
  projectId,
  pointIds,
  flagged,
}: BulkToggleFlagParams): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  if (!pointIds || pointIds.length === 0) {
    return { success: false, updatedCount: 0, error: 'لم يتم تحديد نقاط' };
  }

  try {
    await db.transaction('rw', [db.points, db.auditLogs], async () => {
      const selected = await db.points.where('id').anyOf(pointIds).toArray();
      const updates = selected.map((p) => ({
        ...p,
        flagged,
      }));

      await db.points.bulkPut(updates);

      await logAuditEvent({
        projectId,
        operation: 'BULK_POINT_UPDATE',
        severity: 'INFO',
        summary: `${flagged ? 'تعليم وتأشير' : 'إلغاء تأشير'} ${updates.length} نقطة للمراجعة والتدقيق`,
        metadata: { flagged, pointCount: updates.length },
      });
    });

    return { success: true, updatedCount: pointIds.length };
  } catch (err) {
    return { success: false, updatedCount: 0, error: String(err) };
  }
}

/**
 * Executes a deterministic safe CRS migration for the project points
 */
export async function transformProjectCrs({
  projectId,
  sourceCrs,
  targetCrs,
  mode,
}: TransformProjectCrsParams): Promise<{
  success: boolean;
  transformedCount: number;
  error?: string;
}> {
  if (!projectId || !sourceCrs || !targetCrs) {
    return { success: false, transformedCount: 0, error: 'بيانات نظام الإسناد غير مكتملة' };
  }

  const sourceDef = SUPPORTED_CRS.find((c) => c.code === sourceCrs);
  const targetDef = SUPPORTED_CRS.find((c) => c.code === targetCrs);

  if (!sourceDef || !targetDef) {
    return { success: false, transformedCount: 0, error: 'نظام الإحداثيات المحدد غير مدعوم' };
  }

  try {
    let transformedCount = 0;

    await db.transaction('rw', [db.points, db.projects, db.auditLogs], async () => {
      const points = await db.points.where('projectId').equals(projectId).toArray();
      transformedCount = points.length;

      if (mode === 'TRANSFORM_COORDINATES' && sourceCrs !== targetCrs) {
        const transformedPoints = points.map((p) => {
          const res = transformCoordinates(p.easting, p.northing, p.elevation, sourceCrs, targetCrs);
          return {
            ...p,
            easting: res.x,
            northing: res.y,
            elevation: res.z,
          };
        });

        await db.points.bulkPut(transformedPoints);
      }

      // Update project CRS metadata and recompute geometry
      const project = await db.projects.get(projectId);
      const isRegionalDatum = targetDef.validationLevel === 'REQUIRES_CONTROL_VALIDATION';

      await db.projects.update(projectId, {
        crsCode: targetCrs,
        datumValidationStatus: isRegionalDatum ? 'REQUIRES_GCP_VALIDATION' : 'VALIDATED',
        updatedAt: new Date().toISOString(),
      });

      await syncProjectGeometry(projectId);

      await logAuditEvent({
        projectId,
        operation: 'CRS_CHANGED',
        severity: isRegionalDatum ? 'WARNING' : 'INFO',
        summary:
          mode === 'TRANSFORM_COORDINATES'
            ? `تحويل إحداثيات المشروع جغرافياً من [${sourceCrs}] إلى [${targetCrs}] لعدد ${transformedCount} نقطة`
            : `تحديث تعريف نظام الإسناد للمشروع من [${sourceCrs}] إلى [${targetCrs}] دون تغيير القيم العددية`,
        metadata: {
          previousCrs: sourceCrs,
          newCrs: targetCrs,
          mode,
          transformedCount,
          targetValidationLevel: targetDef.validationLevel,
          datumValidationStatus: isRegionalDatum ? 'REQUIRES_GCP_VALIDATION' : 'VALIDATED',
        },
      });
    });

    return { success: true, transformedCount };
  } catch (err) {
    return { success: false, transformedCount: 0, error: String(err) };
  }
}
