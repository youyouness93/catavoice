import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Chatroom App',
  description: 'A modern chatroom application',
  generator: 'v0.dev',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans antialiased">
        <main className="flex min-h-screen flex-col items-center justify-center p-4">
          {children}
        </main>
      </body>
    </html>
  )
}
