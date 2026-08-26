import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://campo-claro-odepa.juacolk.chatgpt.site'),
  title: 'Campo Claro | Precios mayoristas ODEPA',
  description: 'Historial oficial de precios y volúmenes mayoristas de frutas y hortalizas en Chile.',
  openGraph: {
    title: 'Campo Claro | Precios mayoristas ODEPA',
    description: 'Precios del campo, sin ruido. Datos mayoristas oficiales ODEPA.',
    images: [{ url: '/og.png', width: 1672, height: 941, alt: 'Campo Claro: precios del campo, sin ruido.' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Campo Claro | Precios mayoristas ODEPA',
    description: 'Precios del campo, sin ruido. Datos mayoristas oficiales ODEPA.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
