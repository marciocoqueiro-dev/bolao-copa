import type {Metadata} from 'next';
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css'; // Global styles

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CopaPix • Bolão da Copa com PIX',
  description: 'Bolão da Copa do Mundo com PIX, ranking, palpites e premiação transparente.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable} dark scroll-smooth`}>
      <body className="font-sans antialiased bg-[#020d0a] text-gray-100 selection:bg-emerald-500/30 select-none" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

