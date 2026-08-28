import './globals.css';
import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import { AppShell } from '@/components/layout/app-shell';
import { Toaster } from '@/components/ui/sonner';
import { I18nProvider } from '@/lib/i18n';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SurveyPro AI — Smart Surveying & Geomatics',
  description:
    'Smart Surveying & Geomatics application for field data processing, coordinate transformations, COGO, and QA/QC.',
  applicationName: 'SurveyPro AI',
  themeColor: '#0F172A',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SurveyPro AI',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={`dark ${cairo.variable}`} suppressHydrationWarning>
      <body className="font-cairo bg-slate-950 text-slate-100 antialiased min-h-screen">
        <I18nProvider>
          <AppShell>{children}</AppShell>
          <Toaster position="bottom-left" richColors />
        </I18nProvider>
      </body>
    </html>
  );
}
