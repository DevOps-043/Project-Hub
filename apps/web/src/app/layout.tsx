import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ClientLayout from './ClientLayout';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'Project Hub',
    description: 'Plataforma educativa moderna con inteligencia artificial integrada',
    icons: {
        icon: '/ico.ico',
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="es" suppressHydrationWarning>
            <body className={inter.className}>
                <ClientLayout>
                    {children}
                </ClientLayout>
            </body>
        </html>
    );
}
