'use client';

import { ChevronLeft, ChevronRight, Bot } from 'lucide-react';
import { AIAssistant } from '@/components/survey/ai-assistant';
import { useTranslation } from '@/lib/i18n';

export default function AssistantPage() {
  const { t, isRtl } = useTranslation();
  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="mb-6">
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
          <span>{t('nav.home')}</span>
          <ChevronIcon className="h-3 w-3" />
          <span className="text-fuchsia-400">{t('nav.assistant')}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-fuchsia-500/10 text-fuchsia-400">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">{t('nav.assistant')}</h1>
            <p className="mt-1 text-sm text-slate-400">
              {isRtl
                ? 'تحليل بياناتك المساحية وكشف الأخطاء وتوليد التقارير الهندسية'
                : 'Intelligent geodetic copilot, error triage, and automated survey compliance reporting'}
            </p>
          </div>
        </div>
      </div>
      <AIAssistant />
    </div>
  );
}
