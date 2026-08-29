'use client';

import { useMemo, useState } from 'react';
import { ArrowLeftRight, Ruler } from 'lucide-react';
import { useTranslation, engFormat } from '@/lib/i18n';

type Category = 'length' | 'area' | 'volume';

export function UnitConverter() {
  const { t, isRtl } = useTranslation();
  const [category, setCategory] = useState<Category>('length');
  const [fromUnit, setFromUnit] = useState('m');
  const [toUnit, setToUnit] = useState('km');
  const [value, setValue] = useState('1');

  const categories = useMemo(() => ({
    length: [
      { key: 'm', label: t('units.unitM'), factor: 1 },
      { key: 'km', label: t('units.unitKm'), factor: 1000 },
      { key: 'cm', label: isRtl ? 'سنتيمتر (cm)' : 'Centimeter (cm)', factor: 0.01 },
      { key: 'mm', label: isRtl ? 'مليمتر (mm)' : 'Millimeter (mm)', factor: 0.001 },
      { key: 'inch', label: t('units.unitIn'), factor: 0.0254 },
      { key: 'foot', label: t('units.unitFt'), factor: 0.3048 },
      { key: 'yard', label: t('units.unitYd'), factor: 0.9144 },
      { key: 'mile', label: isRtl ? 'ميل (mi)' : 'Mile (mi)', factor: 1609.344 },
    ],
    area: [
      { key: 'm2', label: t('units.unitSqm'), factor: 1 },
      { key: 'km2', label: t('units.unitSqKm'), factor: 1_000_000 },
      { key: 'hectare', label: t('units.unitHa'), factor: 10_000 },
      { key: 'feddan', label: t('units.unitFeddan'), factor: 4200.83 },
      { key: 'acre', label: t('units.unitAcre'), factor: 4046.8564224 },
      { key: 'sqft', label: t('units.unitSqFt'), factor: 0.09290304 },
    ],
    volume: [
      { key: 'm3', label: t('units.unitCum'), factor: 1 },
      { key: 'liter', label: t('units.unitLiter'), factor: 0.001 },
      { key: 'gallon', label: t('units.unitGallon'), factor: 0.003785411784 },
      { key: 'cm3', label: isRtl ? 'سنتيمتر مكعب (cm³)' : 'Cubic centimeter (cm³)', factor: 0.000001 },
      { key: 'cft', label: t('units.unitCuFt'), factor: 0.028316846592 },
    ],
  }), [t, isRtl]);

  const categoryLabels: Record<Category, string> = useMemo(() => ({
    length: t('units.tabLength'),
    area: t('units.tabArea'),
    volume: t('units.tabVolume'),
  }), [t]);

  const units = categories[category];

  const result = useMemo(() => {
    const input = Number(value);
    if (!Number.isFinite(input)) return 0;
    const fromFactor = units.find((u) => u.key === fromUnit)?.factor ?? 1;
    const toFactor = units.find((u) => u.key === toUnit)?.factor ?? 1;
    const inBaseUnits = input * fromFactor;
    return inBaseUnits / toFactor;
  }, [value, fromUnit, toUnit, units]);

  const switchCategory = (cat: Category) => {
    setCategory(cat);
    const first = categories[cat][0].key;
    const second = categories[cat][1].key;
    setFromUnit(first);
    setToUnit(second);
  };

  const swapUnits = () => {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex gap-2 rounded-xl bg-slate-950/70 p-1.5">
        {(Object.keys(categories) as Category[]).map((cat) => (
          <button
            key={cat}
            onClick={() => switchCategory(cat)}
            className={`flex-1 rounded-lg px-3 py-3 text-xs font-semibold transition-all ${
              category === cat
                ? 'bg-sky-500 text-white shadow-lg shadow-sky-950/30'
                : 'text-slate-500 hover:text-slate-200'
            }`}
          >
            {categoryLabels[cat]}
          </button>
        ))}
      </div>

      <div className="glass-card p-5 sm:p-7">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/10 text-sky-400">
            <Ruler className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{t('units.title')}</h2>
            <p className="mt-1 text-xs text-slate-500">{categoryLabels[category]} — {t('units.subtitle')}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="mb-2 block text-xs font-semibold text-slate-400">{t('units.fromUnit')}</span>
            <select
              value={fromUnit}
              onChange={(e) => setFromUnit(e.target.value)}
              className="h-12 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-sm text-white outline-none focus:border-sky-500"
            >
              {units.map((unit) => (
                <option key={unit.key} value={unit.key} className="bg-slate-900">
                  {unit.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="any"
              dir="ltr"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="1"
              className="mt-3 h-12 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 text-lg font-bold text-white outline-none focus:border-sky-500"
            />
          </div>

          <div>
            <span className="mb-2 block text-xs font-semibold text-slate-400">{t('units.toUnit')}</span>
            <select
              value={toUnit}
              onChange={(e) => setToUnit(e.target.value)}
              className="h-12 w-full rounded-xl border border-slate-700 bg-slate-950/60 px-3 text-sm text-white outline-none focus:border-sky-500"
            >
              {units.map((unit) => (
                <option key={unit.key} value={unit.key} className="bg-slate-900">
                  {unit.label}
                </option>
              ))}
            </select>
            <div className="mt-3 flex h-12 items-center rounded-xl border border-sky-500/20 bg-sky-500/5 px-4">
              <span dir="ltr" className="text-lg font-bold text-sky-300">
                {Number.isFinite(result) ? result.toFixed(6).replace(/\.?0+$/, '') : '—'}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-center">
          <button
            onClick={swapUnits}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-2.5 text-xs font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            {t('units.swapUnits')}
          </button>
        </div>

        {Number.isFinite(Number(value)) && value !== '' && (
          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-center text-sm text-slate-400">
            <span className="font-bold text-white" dir="ltr">{value}</span>{' '}
            {units.find((u) => u.key === fromUnit)?.label} ={' '}
            <span className="font-bold text-sky-400" dir="ltr">{result.toFixed(6).replace(/\.?0+$/, '')}</span>{' '}
            {units.find((u) => u.key === toUnit)?.label}
          </div>
        )}
      </div>
    </div>
  );
}
