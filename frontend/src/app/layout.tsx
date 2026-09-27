import type { Metadata, Viewport } from 'next';
import { Public_Sans } from 'next/font/google';
import { themeBootScript } from '@/lib/theme';
import { Providers } from './providers';
import './globals.css';

const publicSans = Public_Sans({ subsets: ['latin'], variable: '--font-public-sans', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'All Nations University', template: '%s | All Nations University' },
  description: 'University management and campus services platform for All Nations University.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1620' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GH" className={publicSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
