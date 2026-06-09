import type { Metadata } from 'next';
import { AppNav } from '@/components/AppNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'FWCUT — Claims Underwriting',
  description: 'Factory Warranty Claims Underwriting Tool',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppNav />
        {children}
      </body>
    </html>
  );
}