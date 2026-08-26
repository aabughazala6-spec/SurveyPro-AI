import { ImportExportWizard } from '@/components/survey/import-export-wizard';

export default function ImportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          استيراد وتصدير بيانات الرفع المساحي
        </h1>
        <p className="mt-1.5 text-sm text-slate-400">
          معالج متقدم لقراءة وتدقيق ملفات النقاط (PNEZD, CSV, TXT, XYZ) وتصديرها بصيغ AutoCAD DXF و GIS و Google Earth
        </p>
      </div>

      <ImportExportWizard />
    </div>
  );
}
