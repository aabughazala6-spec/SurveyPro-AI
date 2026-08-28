const fs = require('fs');

const code = `'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  FileCheck,
  Globe2,
  Info,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { SUPPORTED_CRS, transformCoordinates } from '@/lib/crs-definitions';
import { transformProjectCrs } from '@/lib/point-operations';
import { db, type PointRecord } from '@/lib/db';
import { useAppStore } from '@/lib/stores/app-store';
import { useTranslation } from '@/lib/i18n';

interface CrsSafetyPanelProps {
  points?: PointRecord[];
  onCrsChanged?: (newCrs: string) => void;
  className?: string;
  compact?: boolean;
}

export function CrsSafetyPanel({
  points = [],
  onCrsChanged,
  className = '',
}: CrsSafetyPanelProps) {
  const { t, isRtl, language } = useTranslation();
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const currentProject = useAppStore((state) => state.currentProject);
  const activeCrs = useAppStore((state) => state.activeCrs);
  const setActiveCrs = useAppStore((state) => state.setActiveCrs);
  const setCurrentProject = useAppStore((state) => state.setCurrentProject);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTargetCrs, setSelectedTargetCrs] = useState<string>('EPSG:32636');
  const [transformMode, setTransformMode] = useState<'TRANSFORM_COORDINATES' | 'ASSIGN_METADATA_ONLY'>(
    'TRANSFORM_COORDINATES'
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmSafetyAcknowledgment, setConfirmSafetyAcknowledgment] = useState(false);

  const currentCrsDef = useMemo(() => {
    return (
      SUPPORTED_CRS.find((c) => c.code === (currentProject?.crsCode || activeCrs)) ||
      SUPPORTED_CRS[0]
    );
  }, [currentProject?.crsCode, activeCrs]);

  const targetCrsDef = useMemo(() => {
    return SUPPORTED_CRS.find((c) => c.code === selectedTargetCrs) || SUPPORTED_CRS[0];
  }, [selectedTargetCrs]);

  const isCurrentAuthoritative = currentCrsDef.validationLevel === 'AUTHORITATIVE_GEODETIC';
  const isTargetRegional = targetCrsDef.validationLevel === 'REQUIRES_CONTROL_VALIDATION';

  // Compute live sample coordinate transformation for preview
  const sampleTransformation = useMemo(() => {
    if (!points || points.length === 0) return null;
    const sample = points.slice(0, 3);
    return sample.map((pt) => {
      try {
        const transformed = transformCoordinates(
          pt.easting,
          pt.northing,
          pt.elevation,
          currentCrsDef.code,
          selectedTargetCrs
        );
        return {
          pointNumber: pt.pointNumber,
          sourceE: pt.easting,
          sourceN: pt.northing,
          targetE: transformed.x,
          targetN: transformed.y,
          deltaE: transformed.x - pt.easting,
          deltaN: transformed.y - pt.northing,
        };
      } catch {
        return null;
      }
    });
  }, [points, currentCrsDef.code, selectedTargetCrs]);

  const handleExecuteCrsMigration = async () => {
    if (isTargetRegional && !confirmSafetyAcknowledgment && transformMode === 'TRANSFORM_COORDINATES') {
      toast.error(t('crsSafety.gcpWarningToast'));
      return;
    }

    setIsProcessing(true);
    try {
      const res = await transformProjectCrs({
        projectId: currentProjectId,
        sourceCrs: currentCrsDef.code,
        targetCrs: selectedTargetCrs,
        mode: transformMode,
      });

      if (!res.success) {
        toast.error(res.error || t('crsSafety.crsTransformError'));
        return;
      }

      // Update global state
      setActiveCrs(selectedTargetCrs);
      const updatedProject = await db.projects.get(currentProjectId);
      if (updatedProject) {
        setCurrentProject(updatedProject);
      }

      toast.success(
        transformMode === 'TRANSFORM_COORDINATES'
          ? t('crsSafety.crsTransformSuccess', { count: res.transformedCount, code: targetCrsDef.code })
          : t('crsSafety.crsAssignedSuccess', { code: targetCrsDef.code })
      );

      onCrsChanged?.(selectedTargetCrs);
      setIsModalOpen(false);
    } catch (err) {
      toast.error(t('crsSafety.crsProcessError'));
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const getCrsName = (crs: typeof currentCrsDef) => {
    return language === 'ar' ? crs.nameAr : (crs.nameEn || crs.nameAr);
  };

  const getTransformationNote = (crs: typeof currentCrsDef) => {
    return language === 'ar' ? crs.transformationNoteAr : (crs.transformationNoteEn || crs.transformationNoteAr);
  };

  return (
    <div className={className}>
      {/* CRS SUMMARY BANNER */}
      <div
        className={\`rounded-2xl border p-4 sm:p-5 transition-all \${
          isCurrentAuthoritative
            ? 'border-emerald-500/20 bg-slate-900/90 shadow-lg shadow-emerald-950/20'
            : 'border-amber-500/30 bg-slate-900/95 shadow-lg shadow-amber-950/20'
        }\`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3.5">
            <div
              className={\`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl \${
                isCurrentAuthoritative
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              }\`}
            >
              {isCurrentAuthoritative ? (
                <ShieldCheck className="h-6 w-6" />
              ) : (
                <ShieldAlert className="h-6 w-6" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-sm font-bold text-white tracking-wider">
                  {currentCrsDef.code}
                </span>
                <span className="text-slate-400 text-xs">•</span>
                <span className="text-xs font-semibold text-slate-200">
                  {getCrsName(currentCrsDef)}
                </span>

                {isCurrentAuthoritative ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> {t('crsSafety.authoritativeBadge')}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-400">
                    <AlertTriangle className="h-3 w-3" /> {t('crsSafety.regionalWarningBadge')}
                  </span>
                )}
              </div>

              <p className="mt-1 text-xs text-slate-400 leading-relaxed max-w-2xl">
                {t('crsSafety.datumPrefix', { datum: currentCrsDef.datumName })} | {t('crsSafety.ellipsoidPrefix', { ellipsoid: currentCrsDef.ellipsoid })} | {t('crsSafety.regionPrefix', { region: currentCrsDef.region })}
              </p>

              {!isCurrentAuthoritative && (
                <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/20 p-2.5 text-[11px] text-amber-300/90 leading-relaxed">
                  <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                  <span>
                    <strong>{t('crsSafety.geodeticAlertTitle')}</strong> {getTransformationNote(currentCrsDef)} {t('crsSafety.geodeticAlertText')}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end lg:self-center shrink-0">
            <button
              onClick={() => {
                setSelectedTargetCrs(
                  currentCrsDef.code === 'EPSG:32636' ? 'EPSG:32638' : 'EPSG:32636'
                );
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/90 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:border-sky-500/40 hover:bg-slate-750 transition-colors"
            >
              <ArrowRightLeft className="h-3.5 w-3.5 text-sky-400" />
              {t('crsSafety.changeCrsBtn')}
            </button>
          </div>
        </div>
      </div>

      {/* CRS MIGRATION & TRANSFORMATION MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm overflow-y-auto">
          <div className={\`w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl sm:p-7 \${isRtl ? 'text-right' : 'text-left'} my-8 max-h-[90vh] overflow-y-auto\`}>
            {/* Header */}
            <div className="mb-6 flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Globe2 className="h-5 w-5 text-sky-400" />
                  {t('crsSafety.dialogTitle')}
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  {currentProject?.name}
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5">
              {/* CURRENT vs TARGET SELECTOR */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                    {t('crsSafety.currentProjectSystem')}
                  </span>
                  <div className="font-mono text-sm font-bold text-emerald-400">
                    {currentCrsDef.code}
                  </div>
                  <p className="text-xs text-slate-300 mt-1 font-medium">
                    {getCrsName(currentCrsDef)}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {t('crsSafety.datumPrefix', { datum: currentCrsDef.datumName })}
                  </p>
                </div>

                <div className="rounded-xl border border-sky-500/30 bg-slate-950 p-4">
                  <label className="text-[11px] font-semibold text-sky-400 block mb-1">
                    {t('crsSafety.targetCrsLabel')}
                  </label>
                  <select
                    value={selectedTargetCrs}
                    onChange={(e) => setSelectedTargetCrs(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-700 bg-slate-900 px-2.5 text-xs text-white outline-none focus:border-sky-500 font-medium"
                  >
                    {SUPPORTED_CRS.map((crs) => (
                      <option key={crs.code} value={crs.code}>
                        {crs.code} - {getCrsName(crs)}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {t('crsSafety.datumPrefix', { datum: targetCrsDef.datumName })} ({targetCrsDef.region})
                  </p>
                </div>
              </div>

              {/* TARGET REGIONAL WARNING */}
              {isTargetRegional && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200">
                  <div className="flex items-center gap-2 font-bold text-amber-300 mb-1">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {t('crsSafety.gcpWarningDialogTitle')}
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-200/90">
                    {getTransformationNote(targetCrsDef)}
                  </p>
                  <label className="mt-3 flex items-center gap-2 cursor-pointer font-semibold text-amber-300 text-xs select-none">
                    <input
                      type="checkbox"
                      checked={confirmSafetyAcknowledgment}
                      onChange={(e) => setConfirmSafetyAcknowledgment(e.target.checked)}
                      className="rounded border-amber-500 bg-slate-900 text-amber-500 focus:ring-0"
                    />
                    {t('crsSafety.gcpAckCheckbox')}
                  </label>
                </div>
              )}

              {/* TRANSFORMATION MODE SELECTION */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-2">
                  {t('crsSafety.applyModeLabel')}
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label
                    className={\`flex flex-col p-3.5 rounded-xl border cursor-pointer transition-all \${
                      transformMode === 'TRANSFORM_COORDINATES'
                        ? 'border-sky-500 bg-sky-500/10 text-white'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }\`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs mb-1 text-sky-300">
                      <input
                        type="radio"
                        name="crsMode"
                        value="TRANSFORM_COORDINATES"
                        checked={transformMode === 'TRANSFORM_COORDINATES'}
                        onChange={() => setTransformMode('TRANSFORM_COORDINATES')}
                        className="text-sky-500 focus:ring-0"
                      />
                      {t('crsSafety.modeMathTransform')}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {t('crsSafety.modeMathTransformDesc')}
                    </p>
                  </label>

                  <label
                    className={\`flex flex-col p-3.5 rounded-xl border cursor-pointer transition-all \${
                      transformMode === 'ASSIGN_METADATA_ONLY'
                        ? 'border-emerald-500 bg-emerald-500/10 text-white'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }\`}
                  >
                    <div className="flex items-center gap-2 font-bold text-xs mb-1 text-emerald-300">
                      <input
                        type="radio"
                        name="crsMode"
                        value="ASSIGN_METADATA_ONLY"
                        checked={transformMode === 'ASSIGN_METADATA_ONLY'}
                        onChange={() => setTransformMode('ASSIGN_METADATA_ONLY')}
                        className="text-emerald-500 focus:ring-0"
                      />
                      {t('crsSafety.modeMetadataOnly')}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      {t('crsSafety.modeMetadataOnlyDesc')}
                    </p>
                  </label>
                </div>
              </div>

              {/* LIVE COORDINATE PREVIEW FOR FIRST 3 POINTS */}
              {transformMode === 'TRANSFORM_COORDINATES' && sampleTransformation && sampleTransformation.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <FileCheck className="h-4 w-4 text-sky-400" />
                      {t('crsSafety.samplePreviewTitle', { count: sampleTransformation.length })}
                    </span>
                    <span className="text-[10px] text-slate-500">{t('crsSafety.totalPointsLabel', { count: points.length })}</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className={\`w-full \${isRtl ? 'text-right' : 'text-left'} text-[11px]\`}>
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400">
                          <th className="py-1 px-2">{t('pointsWorkspace.thPoint')}</th>
                          <th className="py-1 px-2">{t('crsSafety.beforeTransform', { crs: currentCrsDef.code })}</th>
                          <th className="py-1 px-2">{t('crsSafety.afterTransform', { crs: targetCrsDef.code })}</th>
                          <th className="py-1 px-2 text-sky-400">{t('crsSafety.shiftDelta')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850 font-mono text-slate-300">
                        {sampleTransformation.map((item, idx) => {
                          const dE = item?.deltaE ?? 0;
                          const dN = item?.deltaN ?? 0;
                          const sE = item?.sourceE ?? 0;
                          const sN = item?.sourceN ?? 0;
                          const tE = item?.targetE ?? 0;
                          const tN = item?.targetN ?? 0;
                          return (
                            <tr key={idx}>
                              <td className="py-1.5 px-2 font-bold text-emerald-400">P{item?.pointNumber}</td>
                              <td className="py-1.5 px-2" dir="ltr">
                                E: {sE.toFixed(3)}, N: {sN.toFixed(3)}
                              </td>
                              <td className="py-1.5 px-2 text-white" dir="ltr">
                                E: {tE.toFixed(3)}, N: {tN.toFixed(3)}
                              </td>
                              <td className="py-1.5 px-2 text-sky-400" dir="ltr">
                                ΔE: {dE > 0 ? '+' : ''}{dE.toFixed(3)}m, ΔN: {dN > 0 ? '+' : ''}{dN.toFixed(3)}m
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ACTION BUTTONS */}
              <div className="flex gap-3 pt-3 border-t border-slate-800">
                <button
                  onClick={handleExecuteCrsMigration}
                  disabled={isProcessing}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-sky-500 text-xs font-bold text-white shadow-lg shadow-sky-950/40 hover:bg-sky-400 disabled:opacity-50 transition-all"
                >
                  <RefreshCw className={\`h-4 w-4 \${isProcessing ? 'animate-spin' : ''}\`} />
                  {isProcessing ? t('crsSafety.applyingTransform') : t('crsSafety.confirmAndSaveCrs')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isProcessing}
                  className="rounded-xl border border-slate-700 px-5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`;

fs.writeFileSync('./components/survey/crs-safety-panel.tsx', code);
console.log('Successfully updated crs-safety-panel.tsx');
