import type { Metadata } from 'next';
import { AppNav } from '@/components/AppNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'FWCUT — Claims Underwriting',
  description: 'Factory Warranty Claims Underwriting Tool',
};

const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (stored === 'dark' || (!stored && prefersDark)) {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <AppNav />
        {children}
      </body>
    </html>
  );
}