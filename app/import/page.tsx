'use client';

import { useState } from 'react';
import { GuidedImportWizard } from '@/components/survey/guided-import-wizard';
import { ExportCenter } from '@/components/survey/export-center';
import { FileUp, Download } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';

export default function ImportPage() {
  const { t, isRtl } = useTranslation();
  const [activeTab, setActiveTab] = useState<'guided-import' | 'export'>('guided-import');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {t('nav.importExport')}
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            {isRtl
              ? 'مسار عمل استيراد موجه من 9 خطوات لتدقيق الإحداثيات والتحقق من نظم الإسناد، وتصدير بصيغ AutoCAD DXF و CSV و TXT و KML و GeoJSON'
              : 'Guided 9-step survey import workflow with CRS validation, and multi-format AutoCAD DXF, CSV, TXT, KML, and GeoJSON export'}
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 p-1">
          <button
            onClick={() => setActiveTab('guided-import')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'guided-import'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-950/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileUp className="h-4 w-4" />
            {isRtl ? 'معالج الاستيراد الموجه (9-Step Import)' : 'Guided 9-Step Import'}
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'export'
                ? 'bg-sky-500 text-white shadow-md shadow-sky-950/40'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="h-4 w-4" />
            {isRtl ? 'مركز التصدير الهندسي (Export Center)' : 'Engineering Export Center'}
          </button>
        </div>
      </div>

      {activeTab === 'guided-import' ? <GuidedImportWizard /> : <ExportCenter />}
    </div>
  );
}
