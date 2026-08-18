import type { Metadata } from 'next';
import { IBM_Plex_Sans, Inter_Tight, Newsreader } from 'next/font/google';
import './globals.css';
import ClientLayout from './ClientLayout';

const interTight = Inter_Tight({
    subsets: ['latin'],
    variable: '--font-inter-tight',
    display: 'swap',
});

const newsreader = Newsreader({
    subsets: ['latin'],
    variable: '--font-newsreader',
    weight: ['300', '400'],
    display: 'swap',
});

const ibmPlexSans = IBM_Plex_Sans({
    subsets: ['latin'],
    variable: '--font-ibm-plex',
    weight: ['400', '500', '600'],
    display: 'swap',
});

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
            <head>
                <meta name="referrer" content="no-referrer-when-downgrade" />
            </head>
            <body className={`${interTight.variable} ${newsreader.variable} ${ibmPlexSans.variable}`}>
                <ClientLayout>
                    {children}
                </ClientLayout>
            </body>
        </html>
    );
}
