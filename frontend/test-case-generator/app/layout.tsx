import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: 'TestSurge AI — Requirement Intelligence',
  description: 'Generate tests. Detect impact. Prevent escaped defects.',
  openGraph: {
    title: 'TestSurge AI — Requirement Intelligence',
    description: 'Generate tests. Detect impact. Prevent escaped defects.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  )
}
