import Link from 'next/link';
import { ArrowRight, Construction, Home } from 'lucide-react';

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-[calc(100vh-160px)] items-center justify-center px-4 py-10">
      <div className="glass-card w-full max-w-lg p-8 text-center sm:p-10">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400"><Construction className="h-8 w-8" /></div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-sky-400">SurveyPro AI</p>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-400">{description}</p>
        <Link href="/" className="mx-auto mt-7 flex w-fit items-center gap-2 rounded-xl bg-sky-500 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-400"><Home className="h-4 w-4" /> العودة للوحة التحكم <ArrowRight className="h-4 w-4" /></Link>
      </div>
    </div>
  );
}
