'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  Download,
  FileCheck,
  FileCode,
  FileSpreadsheet,
  FileText,
  FileUp,
  Globe,
  HelpCircle,
  Info,
  Layers,
  ListFilter,
  MapPin,
  Maximize2,
  Navigation,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Table,
  Upload,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { db, type ProjectRecord, type PointRecord } from '@/lib/db';
import { useAppStore } from '@/lib/stores/app-store';
import { SUPPORTED_CRS, type CRSDefinition } from '@/lib/crs-definitions';
import {
  analyzeSurveyText,
  validateSurveyDataset,
  commitSurveyImport,
  type DelimiterType,
  type ColumnPreset,
  type ColumnMapping,
  type ImportAnalysisResult,
  type ImportValidationResult,
  type ImportCommitResult,
  type DuplicateStrategy,
} from '@/lib/import-engine';

export function GuidedImportWizard() {
  const router = useRouter();
  const { currentProject, setCurrentProject } = useAppStore();

  // Step indicator state (1 to 9)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // File State (Step 1)
  const [file, setFile] = useState<File | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isReadingFile, setIsReadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Parsing & Delimiter State (Step 2 & 3)
  const [delimiter, setDelimiter] = useState<DelimiterType>('auto');
  const [effectiveDelimiter, setEffectiveDelimiter] = useState<string>(',');
  const [delimiterConfidence, setDelimiterConfidence] = useState<number>(1.0);
  const [hasHeader, setHasHeader] = useState<boolean>(true);
  const [headerRow, setHeaderRow] = useState<string[] | null>(null);
  const [rawSampleRows, setRawSampleRows] = useState<string[][]>([]);
  const [totalLines, setTotalLines] = useState<number>(0);

  // Column Mapping State (Step 4)
  const [columnPreset, setColumnPreset] = useState<ColumnPreset>('PENZD');
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    pointNumberIndex: 0,
    eastingIndex: 1,
    northingIndex: 2,
    elevationIndex: 3,
    descriptionIndex: 4,
  });

  // CRS State (Step 5)
  const [sourceCrs, setSourceCrs] = useState<string>(currentProject?.crsCode || 'EPSG:32638');
  const [targetCrs, setTargetCrs] = useState<string>(currentProject?.crsCode || 'EPSG:32638');
  const [transformCoordinates, setTransformCoordinates] = useState<boolean>(false);
  const [confirmedCrsMismatch, setConfirmedCrsMismatch] = useState<boolean>(false);

  // Validation State (Step 6 & 7)
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [previewFilter, setPreviewFilter] = useState<'ALL' | 'VALID' | 'ERROR' | 'WARNING'>('ALL');
  const [previewPage, setPreviewPage] = useState<number>(1);
  const PREVIEW_PAGE_SIZE = 50;

  // Duplicate Strategy & Commit State (Step 8)
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('IMPORT_ONLY_NEW');
  const [isCommitting, setIsCommitting] = useState<boolean>(false);
  const [commitResult, setCommitResult] = useState<ImportCommitResult | null>(null);

  // Existing project points for duplicate check
  const [existingPointNumbers, setExistingPointNumbers] = useState<number[]>([]);

  // Load existing project points on mount or project change
  useEffect(() => {
    async function loadProjectPoints() {
      if (currentProject?.id) {
        const pts = await db.points.where('projectId').equals(currentProject.id).toArray();
        setExistingPointNumbers(pts.map((p) => p.pointNumber));
        if (currentProject.crsCode) {
          setTargetCrs(currentProject.crsCode);
          setSourceCrs(currentProject.crsCode);
        }
      }
    }
    loadProjectPoints();
  }, [currentProject]);

  // Handle File Selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsReadingFile(true);

    try {
      const text = await selectedFile.text();
      setFileContent(text);

      // Auto-analyze
      const analysis = analyzeSurveyText(text, 'auto');
      setEffectiveDelimiter(analysis.detectedDelimiter);
      setDelimiterConfidence(analysis.delimiterConfidence);
      setHasHeader(analysis.hasHeader);
      setHeaderRow(analysis.headerRow);
      setRawSampleRows(analysis.rawSampleRows);
      setTotalLines(analysis.totalLines);
      setColumnPreset(analysis.suggestedPreset);
      setColumnMapping(analysis.suggestedMapping);

      toast.success(`تم قراءة الملف بنجاح (${analysis.totalLines} سطر)`);
    } catch (err) {
      toast.error('تعذر قراءة محتوى الملف');
      console.error(err);
    } finally {
      setIsReadingFile(false);
    }
  };

  // Re-analyze when delimiter or header toggles
  const triggerReAnalysis = (newDelim: DelimiterType, newHeaderToggle: boolean) => {
    if (!fileContent) return;
    const analysis = analyzeSurveyText(fileContent, newDelim);
    setEffectiveDelimiter(analysis.detectedDelimiter);
    setDelimiterConfidence(analysis.delimiterConfidence);
    setHeaderRow(analysis.headerRow);
    setRawSampleRows(analysis.rawSampleRows);
    setTotalLines(analysis.totalLines);
    setColumnPreset(analysis.suggestedPreset);
    setColumnMapping(analysis.suggestedMapping);
  };

  // Run full validation when entering step 6/7
  const runValidation = () => {
    if (!fileContent) return;
    setIsValidating(true);

    try {
      const res = validateSurveyDataset(fileContent, {
        delimiter: effectiveDelimiter,
        hasHeader,
        mapping: columnMapping,
        sourceCrs,
        targetCrs,
        transformCoordinatesToTarget: transformCoordinates,
        existingProjectPointNumbers: existingPointNumbers,
      });
      setValidationResult(res);
    } catch (err) {
      toast.error('حدث خطأ أثناء تدقيق البيانات');
      console.error(err);
    } finally {
      setIsValidating(false);
    }
  };

  // Preset Mapping Change
  const handlePresetChange = (preset: ColumnPreset) => {
    setColumnPreset(preset);
    if (preset === 'PNEZD') {
      setColumnMapping({ pointNumberIndex: 0, northingIndex: 1, eastingIndex: 2, elevationIndex: 3, descriptionIndex: 4 });
    } else if (preset === 'PENZD') {
      setColumnMapping({ pointNumberIndex: 0, eastingIndex: 1, northingIndex: 2, elevationIndex: 3, descriptionIndex: 4 });
    } else if (preset === 'NEZ') {
      setColumnMapping({ pointNumberIndex: -1, northingIndex: 0, eastingIndex: 1, elevationIndex: 2, descriptionIndex: -1 });
    } else if (preset === 'ENZ') {
      setColumnMapping({ pointNumberIndex: -1, eastingIndex: 0, northingIndex: 1, elevationIndex: 2, descriptionIndex: -1 });
    }
  };

  // Step Navigation
  const goToStep = (step: number) => {
    if (step === 6 || step === 7) {
      runValidation();
    }
    setCurrentStep(step);
  };

  // Atomic Commit Execution
  const handleCommit = async () => {
    if (!currentProject || !validationResult || !file) return;

    setIsCommitting(true);
    try {
      const res = await commitSurveyImport(currentProject.id, file.name, validationResult, duplicateStrategy);
      setCommitResult(res);

      if (res.success) {
        toast.success(`تم استيراد ${res.importedCount} نقطة بنجاح في قاعدة البيانات`);
        setCurrentStep(9); // Go to summary
      } else {
        toast.error(`فشل الاستيراد: ${res.error || 'حدث خطأ غير معروف'}`);
      }
    } catch (err) {
      toast.error('فشل تنفيذ المعاملة الذرية');
      console.error(err);
    } finally {
      setIsCommitting(false);
    }
  };

  const currentSourceCrsDef = SUPPORTED_CRS.find((c) => c.code === sourceCrs);
  const currentTargetCrsDef = SUPPORTED_CRS.find((c) => c.code === targetCrs);

  // Filtered preview rows
  const filteredPreviewRows = useMemo(() => {
    if (!validationResult) return [];
    if (previewFilter === 'VALID') return validationResult.validRows;
    if (previewFilter === 'ERROR') return validationResult.invalidRows;
    if (previewFilter === 'WARNING') return validationResult.warningRows;
    return [...validationResult.invalidRows, ...validationResult.validRows].sort((a, b) => a.rowIndex - b.rowIndex);
  }, [validationResult, previewFilter]);

  const paginatedRows = useMemo(() => {
    const start = (previewPage - 1) * PREVIEW_PAGE_SIZE;
    return filteredPreviewRows.slice(start, start + PREVIEW_PAGE_SIZE);
  }, [filteredPreviewRows, previewPage]);

  const totalPreviewPages = Math.ceil(filteredPreviewRows.length / PREVIEW_PAGE_SIZE) || 1;

  return (
    <div className="space-y-6">
      {/* Workflow Stepper Header */}
      <div className="glass-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-semibold text-white">المشروع النشط:</span>
              <span className="rounded-md bg-slate-800 px-2 py-0.5 font-medium text-sky-400">
                {currentProject?.name || 'مخطط أرض النخيل'}
              </span>
              <span>•</span>
              <span>نظام المشروع:</span>
              <span className="font-mono text-slate-300">{targetCrs}</span>
            </div>
            <h2 className="mt-1 text-lg font-bold text-white">
              معالج استيراد بيانات الرفع المساحي الموجه (9-Step Guided Import)
            </h2>
          </div>

          {/* Step Pill */}
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-sky-500/10 px-3 py-1 text-xs font-bold text-sky-400 border border-sky-500/20">
              الخطوة {currentStep} من 9
            </span>
          </div>
        </div>

        {/* Stepper Progress Bar */}
        <div className="mt-5 grid grid-cols-9 gap-1 sm:gap-2">
          {[
            { num: 1, label: 'الملف' },
            { num: 2, label: 'الفاصل' },
            { num: 3, label: 'الترويسة' },
            { num: 4, label: 'الأعمدة' },
            { num: 5, label: 'CRS' },
            { num: 6, label: 'التدقيق' },
            { num: 7, label: 'المعاينة' },
            { num: 8, label: 'الاعتماد' },
            { num: 9, label: 'الملخص' },
          ].map((s) => {
            const isCompleted = currentStep > s.num;
            const isCurrent = currentStep === s.num;
            return (
              <div key={s.num} className="text-center">
                <div
                  className={`h-2 rounded-full transition-all ${
                    isCompleted ? 'bg-emerald-500' : isCurrent ? 'bg-sky-500' : 'bg-slate-800'
                  }`}
                />
                <span
                  className={`mt-1.5 hidden sm:block text-[11px] truncate font-medium ${
                    isCurrent ? 'text-sky-400 font-bold' : isCompleted ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ============================================================ */}
      {/* STEP 1: FILE SELECTION */}
      {/* ============================================================ */}
      {currentStep === 1 && (
        <div className="glass-card p-6">
          <div className="mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <FileUp className="h-5 w-5 text-sky-400" />
              الخطوة 1: اختيار ملف الرفع المساحي
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              اختر ملف نقاط مساحية بصيغة نصية مفصولة بفواصل (CSV, TXT, XYZ, DAT). المعالجة تتم محلياً بالكامل.
            </p>
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-700 bg-slate-900/40 p-6 text-center transition-all hover:border-sky-500 hover:bg-slate-900/80"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.xyz,.dat,.prn"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div className="space-y-3">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                  <FileCheck className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{file.name}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    الحجم: {(file.size / 1024).toFixed(1)} KB • عدد السطور المقدر: {totalLines} سطر
                  </p>
                </div>
                <span className="inline-block rounded-lg bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">
                  جاهز للمتابعة
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400">
                  <Upload className="h-7 w-7" />
                </div>
                <p className="text-sm font-semibold text-slate-200">اسحب الملف هنا أو انقر للاختيار</p>
                <p className="text-xs text-slate-500">الصيغ المدعومة: CSV, TXT, XYZ, DAT (حجم حتى 50,000+ نقطة)</p>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => goToStep(2)}
              disabled={!file || isReadingFile}
              className="flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-sky-400 disabled:opacity-50"
            >
              المتابعة للخطوة 2: الفاصل
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 2: DELIMITER DETECTION */}
      {/* ============================================================ */}
      {currentStep === 2 && (
        <div className="glass-card p-6">
          <div className="mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ListFilter className="h-5 w-5 text-sky-400" />
              الخطوة 2: كشف الفاصل بين الأعمدة (Delimiter Detection)
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              تم كشف الفاصل تلقائياً عبر فحص التباين الإحصائي. يمكنك تعديله يدوياً ومعاينة النتيجة.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-5">
            {[
              { id: ',', label: 'فاصلة (Comma ,)', desc: 'CSV القياسي' },
              { id: ';', label: 'فاصلة منقوطة (Semicolon ;)', desc: 'الأوروبي / Total Station' },
              { id: '\t', label: 'مسافة جدولية (Tab \\t)', desc: 'TXT / Excel' },
              { id: '|', label: 'خط عمودي (Pipe |)', desc: 'قواعد البيانات' },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  setDelimiter(d.id as DelimiterType);
                  setEffectiveDelimiter(d.id);
                  triggerReAnalysis(d.id as DelimiterType, hasHeader);
                }}
                className={`flex flex-col items-start rounded-xl border p-4 text-right transition-all ${
                  effectiveDelimiter === d.id
                    ? 'border-sky-500 bg-sky-500/10 text-white'
                    : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:bg-slate-900'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-bold text-sm text-white">{d.label}</span>
                  {effectiveDelimiter === d.id && <CheckCircle2 className="h-4 w-4 text-sky-400" />}
                </div>
                <span className="text-[11px] text-slate-500 mt-1">{d.desc}</span>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300">معاينة تقسيم الأعمدة (أول 5 أسطر):</span>
              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-slate-400">
                درجة الثقة: {(delimiterConfidence * 100).toFixed(0)}%
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs text-slate-300" dir="ltr">
                <tbody>
                  {rawSampleRows.slice(0, 5).map((row, rIdx) => (
                    <tr key={rIdx} className="border-b border-slate-800/40">
                      <td className="py-1.5 px-2 text-slate-500 font-mono text-[10px]">#{rIdx + 1}</td>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="py-1.5 px-2 font-mono bg-slate-900/30 border-r border-slate-800/30">
                          {cell || <span className="text-slate-600">NULL</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 flex justify-between">
            <button
              onClick={() => goToStep(1)}
              className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              <ArrowRight className="h-4 w-4" />
              الرجوع
            </button>
            <button
              onClick={() => goToStep(3)}
              className="flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-sky-400"
            >
              المتابعة للخطوة 3: الترويسة
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 3: HEADER DETECTION */}
      {/* ============================================================ */}
      {currentStep === 3 && (
        <div className="glass-card p-6">
          <div className="mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Table className="h-5 w-5 text-sky-400" />
              الخطوة 3: كشف وتحديد صف الترويسة (Header Detection)
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              حدد ما إذا كان السطر الأول في الملف يحتوي على أسماء الأعمدة (مثل Point, Easting, Northing).
            </p>
          </div>

          <div className="flex gap-4 mb-5">
            <button
              onClick={() => {
                setHasHeader(true);
                triggerReAnalysis(effectiveDelimiter as DelimiterType, true);
              }}
              className={`flex-1 rounded-xl border p-4 text-center transition-all ${
                hasHeader ? 'border-sky-500 bg-sky-500/10 text-white' : 'border-slate-800 bg-slate-900/40 text-slate-400'
              }`}
            >
              <p className="font-bold text-sm">يحتوي على ترويسة (Header Present)</p>
              <p className="text-[11px] text-slate-500 mt-1">تجاهل السطر الأول من استيراد النقاط واستخدامه لتعيين الأعمدة</p>
            </button>
            <button
              onClick={() => {
                setHasHeader(false);
                triggerReAnalysis(effectiveDelimiter as DelimiterType, false);
              }}
              className={`flex-1 rounded-xl border p-4 text-center transition-all ${
                !hasHeader ? 'border-sky-500 bg-sky-500/10 text-white' : 'border-slate-800 bg-slate-900/40 text-slate-400'
              }`}
            >
              <p className="font-bold text-sm">لا يحتوي على ترويسة (No Header)</p>
              <p className="text-[11px] text-slate-500 mt-1">السطر الأول هو نقطة مساحية فعلية</p>
            </button>
          </div>

          {headerRow && hasHeader && (
            <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-4 mb-5">
              <p className="text-xs font-bold text-sky-400 mb-2">الترويسة المكتشفة في السطر #1:</p>
              <div className="flex flex-wrap gap-2">
                {headerRow.map((h, idx) => (
                  <span key={idx} className="rounded-md bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 text-xs font-mono text-sky-300">
                    العمود {idx + 1}: {h}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <button
              onClick={() => goToStep(2)}
              className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              <ArrowRight className="h-4 w-4" />
              الرجوع
            </button>
            <button
              onClick={() => goToStep(4)}
              className="flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-sky-400"
            >
              المتابعة للخطوة 4: تعيين الأعمدة
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 4: COLUMN MAPPING */}
      {/* ============================================================ */}
      {currentStep === 4 && (
        <div className="glass-card p-6">
          <div className="mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="h-5 w-5 text-sky-400" />
              الخطوة 4: تعيين أعمدة الإحداثيات (Column Mapping)
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              اختر قالب الرفع المساحي القياسي أو عيّن مؤشرات الأعمدة يدوياً.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {(['PENZD', 'PNEZD', 'ENZ', 'NEZ', 'CUSTOM'] as ColumnPreset[]).map((p) => (
              <button
                key={p}
                onClick={() => handlePresetChange(p)}
                className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
                  columnPreset === p
                    ? 'bg-sky-500 text-white shadow-lg shadow-sky-950/40'
                    : 'bg-slate-800/80 text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                قالب {p}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-5">
            {[
              { label: 'رقم النقطة (Point Number)', key: 'pointNumberIndex' as const, required: true },
              { label: 'الإحداثي الشرقي (Easting X)', key: 'eastingIndex' as const, required: true },
              { label: 'الإحداثي الشمالي (Northing Y)', key: 'northingIndex' as const, required: true },
              { label: 'المنسوب (Elevation Z)', key: 'elevationIndex' as const, required: false },
              { label: 'الوصف / الكود (Description)', key: 'descriptionIndex' as const, required: false },
            ].map((field) => (
              <div key={field.key} className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5">
                <label className="text-xs font-bold text-slate-300 flex items-center justify-between mb-2">
                  <span>{field.label}</span>
                  {field.required ? (
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">إلزامي</span>
                  ) : (
                    <span className="text-[10px] text-slate-500">اختياري</span>
                  )}
                </label>
                <select
                  value={columnMapping[field.key]}
                  onChange={(e) => {
                    setColumnPreset('CUSTOM');
                    setColumnMapping({ ...columnMapping, [field.key]: Number(e.target.value) });
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
                >
                  <option value={-1}>-- غير محدد --</option>
                  {(rawSampleRows[0] || []).map((colVal, colIdx) => (
                    <option key={colIdx} value={colIdx}>
                      العمود {colIdx + 1} {headerRow ? `(${headerRow[colIdx] || ''})` : ''} — عينة: {colVal}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-between">
            <button
              onClick={() => goToStep(3)}
              className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              <ArrowRight className="h-4 w-4" />
              الرجوع
            </button>
            <button
              onClick={() => goToStep(5)}
              className="flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-sky-400"
            >
              المتابعة للخطوة 5: نظام الإحداثيات CRS
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 5: CRS SELECTION & VALIDATION */}
      {/* ============================================================ */}
      {currentStep === 5 && (
        <div className="glass-card p-6">
          <div className="mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Globe className="h-5 w-5 text-sky-400" />
              الخطوة 5: نظام الإسناد والإحداثيات (CRS Selection & Safety)
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              تأكد من مطابقة نظام إحداثيات الملف المصدر مع نظام المشروع الحالي لمنع أي إزاحات جغرافية.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-5">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <label className="block text-xs font-bold text-slate-300 mb-2">
                نظام إحداثيات الملف المصدر (Source CRS):
              </label>
              <select
                value={sourceCrs}
                onChange={(e) => setSourceCrs(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
              >
                {SUPPORTED_CRS.map((crs) => (
                  <option key={crs.code} value={crs.code}>
                    {crs.code} - {crs.name} ({crs.region})
                  </option>
                ))}
              </select>
              {currentSourceCrsDef?.validationLevel === 'REQUIRES_CONTROL_VALIDATION' && (
                <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-2.5 text-[11px] text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                  <div>
                    <span className="font-bold">تنبيه هندسي (REQUIRES_CONTROL_VALIDATION):</span>
                    <p className="mt-0.5 text-slate-300">
                      هذا المرجع الإقليمي يتطلب التحقق على نقاط تحكم أرضية (GCPs) لمعايرة السنتيمتر.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <label className="block text-xs font-bold text-slate-300 mb-2">
                نظام إحداثيات المشروع المستهدف (Project Target CRS):
              </label>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs">
                <span className="font-mono font-bold text-sky-400">{targetCrs}</span>
                <p className="text-[11px] text-slate-400 mt-1">{currentTargetCrsDef?.name}</p>
              </div>
            </div>
          </div>

          {sourceCrs !== targetCrs && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 mb-5">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs mb-2">
                <AlertTriangle className="h-4 w-4" />
                تنبيه: نظام إحداثيات الملف ({sourceCrs}) يختلف عن نظام المشروع ({targetCrs})!
              </div>
              <p className="text-xs text-slate-300 mb-3">
                القاعدة الهندسية: لا يتم تغيير أي إحداثيات بصمت. اختر الإجراء المطلوب:
              </p>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="crsStrategy"
                    checked={!transformCoordinates}
                    onChange={() => setTransformCoordinates(false)}
                    className="text-sky-500"
                  />
                  <span>استيراد الإحداثيات كما هي دون تحويل (الافتراض أنها مدخلة بنظام المشروع)</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="radio"
                    name="crsStrategy"
                    checked={transformCoordinates}
                    onChange={() => setTransformCoordinates(true)}
                    className="text-sky-500"
                  />
                  <span>
                    تحويل الإحداثيات رياضياً من <span className="font-mono text-sky-400">{sourceCrs}</span> إلى{' '}
                    <span className="font-mono text-emerald-400">{targetCrs}</span>
                  </span>
                </label>
              </div>
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <button
              onClick={() => goToStep(4)}
              className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              <ArrowRight className="h-4 w-4" />
              الرجوع
            </button>
            <button
              onClick={() => goToStep(6)}
              className="flex items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-sky-400"
            >
              المتابعة للخطوة 6: تشغيل التدقيق الهندسي
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 6 & 7: VALIDATION & DATA PREVIEW */}
      {/* ============================================================ */}
      {(currentStep === 6 || currentStep === 7) && (
        <div className="glass-card p-6">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                الخطوة {currentStep}: التدقيق والمعاينة التفصيلية (Validation & Preview)
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                نتائج الفحص الكامل لبيانات الملف قبل حفظها في قاعدة البيانات.
              </p>
            </div>

            <button
              onClick={runValidation}
              disabled={isValidating}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isValidating ? 'animate-spin' : ''}`} />
              إعادة الفحص
            </button>
          </div>

          {validationResult && (
            <div className="space-y-4">
              {/* Stat Cards */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center">
                  <span className="text-[11px] text-slate-400">إجمالي السطور</span>
                  <p className="text-xl font-bold text-white mt-0.5">{validationResult.totalRows}</p>
                </div>
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3 text-center">
                  <span className="text-[11px] text-emerald-400">النقاط الصالحة</span>
                  <p className="text-xl font-bold text-emerald-400 mt-0.5">{validationResult.validRows.length}</p>
                </div>
                <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-3 text-center">
                  <span className="text-[11px] text-red-400">الصفوف المعطوبة (Errors)</span>
                  <p className="text-xl font-bold text-red-400 mt-0.5">{validationResult.invalidRows.length}</p>
                </div>
                <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 text-center">
                  <span className="text-[11px] text-amber-400">تنبيهات (Warnings)</span>
                  <p className="text-xl font-bold text-amber-400 mt-0.5">{validationResult.warningRows.length}</p>
                </div>
              </div>

              {/* Blocking Errors Alert */}
              {validationResult.invalidRows.length > 0 && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-950/30 p-4 text-xs text-red-300">
                  <AlertCircle className="h-5 w-5 shrink-0 text-red-400" />
                  <div>
                    <span className="font-bold">يوجد {validationResult.invalidRows.length} صف معطوب يمنع الاستيراد المباشر:</span>
                    <p className="mt-1 text-slate-300">
                      يرجى مراجعة وتصحيح تعيين الأعمدة في الخطوة 4 أو إصلاح السطور المعطوبة.
                    </p>
                  </div>
                </div>
              )}

              {/* Filter Tabs */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex gap-2">
                  {(['ALL', 'VALID', 'ERROR', 'WARNING'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => {
                        setPreviewFilter(tab);
                        setPreviewPage(1);
                      }}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all ${
                        previewFilter === tab
                          ? 'bg-sky-500 text-white'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {tab === 'ALL'
                        ? `الكل (${filteredPreviewRows.length})`
                        : tab === 'VALID'
                        ? `صالح (${validationResult.validRows.length})`
                        : tab === 'ERROR'
                        ? `أخطاء (${validationResult.invalidRows.length})`
                        : `تحذيرات (${validationResult.warningRows.length})`}
                    </button>
                  ))}
                </div>

                <span className="text-xs text-slate-400">
                  صفحة {previewPage} من {totalPreviewPages}
                </span>
              </div>

              {/* Preview Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60 max-h-80">
                <table className="w-full text-right text-xs text-slate-300">
                  <thead className="sticky top-0 bg-slate-900 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3">السطر</th>
                      <th className="py-2 px-3">الحالة</th>
                      <th className="py-2 px-3">رقم النقطة</th>
                      <th className="py-2 px-3">الشرقي (E)</th>
                      <th className="py-2 px-3">الشمالي (N)</th>
                      <th className="py-2 px-3">المنسوب (Z)</th>
                      <th className="py-2 px-3">الوصف</th>
                      <th className="py-2 px-3">الملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((r) => (
                      <tr key={r.rowIndex} className="border-b border-slate-800/40 hover:bg-slate-900/40">
                        <td className="py-1.5 px-3 font-mono text-slate-500">#{r.rowIndex}</td>
                        <td className="py-1.5 px-3">
                          {r.isValid ? (
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                              صالح
                            </span>
                          ) : (
                            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">
                              خطأ
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 font-mono font-bold text-white">{r.pointNumber}</td>
                        <td className="py-1.5 px-3 font-mono">{r.easting.toFixed(3)}</td>
                        <td className="py-1.5 px-3 font-mono">{r.northing.toFixed(3)}</td>
                        <td className="py-1.5 px-3 font-mono">{r.elevation.toFixed(2)}</td>
                        <td className="py-1.5 px-3 text-slate-400">{r.description || '-'}</td>
                        <td className="py-1.5 px-3 text-[11px] text-amber-400">
                          {r.issues.map((iss) => iss.message).join(' | ') || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {totalPreviewPages > 1 && (
                <div className="flex justify-center gap-2 mt-2">
                  <button
                    onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                    disabled={previewPage === 1}
                    className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300 disabled:opacity-40"
                  >
                    السابق
                  </button>
                  <button
                    onClick={() => setPreviewPage((p) => Math.min(totalPreviewPages, p + 1))}
                    disabled={previewPage === totalPreviewPages}
                    className="rounded-md border border-slate-800 bg-slate-900 px-3 py-1 text-xs text-slate-300 disabled:opacity-40"
                  >
                    التالي
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <button
              onClick={() => goToStep(5)}
              className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              <ArrowRight className="h-4 w-4" />
              الرجوع
            </button>
            <button
              onClick={() => goToStep(8)}
              disabled={!validationResult?.canCommit && validationResult?.validRows.length === 0}
              className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-400 disabled:opacity-50"
            >
              المتابعة للخطوة 8: اعتماد الاستيراد الذري
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 8: COMMIT TRANSACTION */}
      {/* ============================================================ */}
      {currentStep === 8 && (
        <div className="glass-card p-6">
          <div className="mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Database className="h-5 w-5 text-sky-400" />
              الخطوة 8: اعتماد المعاملة الذرية (Atomic Commit to Dexie)
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              اختر استراتيجية معالجة تكرار النقاط وسيتم حفظ النقاط ذرية مع توثيق سجل التدقيق.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 mb-5 space-y-4">
            <label className="block text-xs font-bold text-slate-300">
              استراتيجية معالجة أرقام النقاط الموجودة مسبقاً في المشروع:
            </label>

            <div className="space-y-3">
              {[
                {
                  id: 'IMPORT_ONLY_NEW' as const,
                  label: 'استيراد النقاط الجديدة فقط وتخطي المكرر (موصى به)',
                  desc: 'يحافظ على النقاط الحالية في المشروع ويتجاهل أي نقطة لها نفس الرقم',
                },
                {
                  id: 'OVERWRITE_CONFIRMED' as const,
                  label: 'تحديث واستبدال النقاط الموجودة بالقيم الجديدة من الملف',
                  desc: 'يقوم بتحديث إحداثيات ومناسيب النقاط المكررة مع توثيق التعديل',
                },
                {
                  id: 'CANCEL' as const,
                  label: 'إلغاء الاستيراد بالكامل عند وجود أي تكرار',
                  desc: 'يمنع الاستيراد تماماً لحين مراجعة وتعديل الترقيم',
                },
              ].map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition-all ${
                    duplicateStrategy === opt.id
                      ? 'border-sky-500 bg-sky-500/10 text-white'
                      : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:bg-slate-950'
                  }`}
                >
                  <input
                    type="radio"
                    name="dupStrategy"
                    checked={duplicateStrategy === opt.id}
                    onChange={() => setDuplicateStrategy(opt.id)}
                    className="mt-1 text-sky-500"
                  />
                  <div>
                    <p className="text-xs font-bold text-slate-200">{opt.label}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-6 flex justify-between">
            <button
              onClick={() => goToStep(7)}
              className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800"
            >
              <ArrowRight className="h-4 w-4" />
              الرجوع للمعاينة
            </button>
            <button
              onClick={handleCommit}
              disabled={isCommitting}
              className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-950/40 hover:bg-emerald-400 disabled:opacity-50"
            >
              {isCommitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  جاري الحفظ الذري...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  تأكيد وحفظ النقاط في قاعدة البيانات
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 9: IMPORT SUMMARY */}
      {/* ============================================================ */}
      {currentStep === 9 && commitResult && (
        <div className="glass-card p-6">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h3 className="text-xl font-bold text-white">اكتمل الاستيراد المساحي بنجاح!</h3>
            <p className="mt-1 text-xs text-slate-400">
              تم تحديث قاعدة بيانات المشروع وتسجيل المعاملة في سجل التدقيق الهندسي (Audit Trail).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center">
              <span className="text-[11px] text-slate-400">النقاط المستوردة</span>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{commitResult.importedCount}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center">
              <span className="text-[11px] text-slate-400">النقاط المتخطاة</span>
              <p className="text-2xl font-bold text-slate-400 mt-1">{commitResult.skippedCount}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center">
              <span className="text-[11px] text-slate-400">العدد قبل الاستيراد</span>
              <p className="text-2xl font-bold text-slate-400 mt-1">{commitResult.pointCountBefore}</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-center">
              <span className="text-[11px] text-slate-400">إجمالي نقاط المشروع الآن</span>
              <p className="text-2xl font-bold text-sky-400 mt-1">{commitResult.pointCountAfter}</p>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 mb-6 text-xs text-slate-300 space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">المشروع:</span>
              <span className="font-semibold text-white">{currentProject?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">نظام الإحداثيات CRS:</span>
              <span className="font-mono text-sky-400">{targetCrs}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">الملف المصدر:</span>
              <span className="font-mono text-slate-300">{file?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">وقت التوثيق:</span>
              <span className="font-mono text-slate-400">{commitResult.timestamp}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <button
              onClick={() => router.push('/points')}
              className="flex items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 py-3 text-xs font-bold text-white hover:bg-sky-400"
            >
              <Table className="h-4 w-4" />
              عرض جدول النقاط
            </button>
            <button
              onClick={() => router.push('/qa-qc')}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-4 py-3 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30"
            >
              <ShieldCheck className="h-4 w-4" />
              تشغيل تدقيق الجودة QA/QC
            </button>
            <button
              onClick={() => {
                setFile(null);
                setFileContent('');
                setValidationResult(null);
                setCommitResult(null);
                setCurrentStep(1);
              }}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-3 text-xs font-bold text-slate-300 hover:bg-slate-800"
            >
              <FileUp className="h-4 w-4" />
              استيراد ملف آخر
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
