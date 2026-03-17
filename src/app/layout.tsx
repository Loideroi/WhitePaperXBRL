import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/components/auth/Providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'WhitePaper XBRL',
  description: 'Transform crypto-asset whitepapers to MiCA-compliant iXBRL format',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
