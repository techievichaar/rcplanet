import type { Metadata } from 'next'
import { Inter, Poppins } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { Providers } from './providers'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
})

const poppins = Poppins({ 
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-poppins',
})

export const metadata: Metadata = {
  title: 'RCPlanat - Premium RC Toys & Accessories',
  description: 'Discover the best selection of RC toys, drones, cars, and accessories. Shop high-quality remote control products for all ages.',
  keywords: 'RC toys, remote control, drones, RC cars, RC accessories',
  openGraph: {
    title: 'RCPlanat - Premium RC Toys & Accessories',
    description: 'Discover the best selection of RC toys, drones, cars, and accessories.',
    images: ['/og-image.jpg'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${poppins.variable}`}>
      <body className="min-h-screen bg-gray-50">
        <Providers>
          <div className="flex flex-col min-h-screen">
            <Header />
            <main className="flex-grow">
              {children}
            </main>
            <Footer />
          </div>
          <Toaster position="bottom-right" />
        </Providers>
      </body>
    </html>
  )
} 