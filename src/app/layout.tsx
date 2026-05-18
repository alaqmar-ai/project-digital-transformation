import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import AppProvider from '@/components/AppProvider';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['400', '500', '600', '700', '800'],
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
  weight: ['400', '500', '600'],
});

export const metadata: Metadata = {
  title: {
    default: 'EPMS - Enterprise Project Monitoring System',
    template: '%s · EPMS',
  },
  description:
    'Enterprise Project Monitoring System - track equipment projects, schedules, attendance, and analytics for manufacturing and engineering operations.',
  keywords: ['EPMS', 'project monitoring', 'engineering', 'manufacturing', 'workforce'],
  authors: [{ name: 'EPMS' }],
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#2563EB',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="antialiased">
        <Suspense>
          <AppProvider>{children}</AppProvider>
        </Suspense>
      </body>
    </html>
  );
}
