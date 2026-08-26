'use client';

import { useState } from 'react';
import { GuidedImportWizard } from '@/components/survey/guided-import-wizard';
import { ImportExportWizard } from '@/components/survey/import-export-wizard';
import { FileUp, Download, ShieldCheck } from 'lucide-react';

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<'guided-import' | 'export'>('guided-import');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            مركز استيراد وتصدير بيانات الرفع المساحي
          </h1>
          <p className="mt-1.5 text-sm text-slate-400">
            مسار عمل استيراد موجه من 9 خطوات لتدقيق الإحداثيات والتحقق من نظم الإسناد، وتصدير بصيغ DXF و CSV و KML
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
            معالج الاستيراد الموجه (9-Step Import)
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
            التصدير الفوري (Export)
          </button>
        </div>
      </div>

      {activeTab === 'guided-import' ? <GuidedImportWizard /> : <ImportExportWizard />}
    </div>
  );
}
