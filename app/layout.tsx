import './globals.css';
import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import { AppShell } from '@/components/layout/app-shell';
import { Toaster } from '@/components/ui/sonner';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SurveyPro AI — نظام المساحة الذكي',
  description:
    'تطبيق مساحي ذكي لإدارة المشاريع، تحويل الإحداثيات، حساب المساحات، والتحليل بالذكاء الاصطناعي.',
  applicationName: 'SurveyPro AI',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SurveyPro AI',
  },
};

export const viewport = {
  themeColor: '#0F172A',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={`dark ${cairo.variable}`} suppressHydrationWarning>
      <body className="font-cairo bg-slate-950 text-slate-100 antialiased min-h-screen">
        <AppShell>{children}</AppShell>
        <Toaster position="bottom-left" richColors />
      </body>
    </html>
  );
}
