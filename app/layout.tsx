import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Cinzel } from 'next/font/google'
import Script from 'next/script'
import { auth, signOut } from '@/auth'
import { ThemeToggle } from '@/components/theme-toggle'
import './globals.css'

// Runs before paint so the stored theme applies with no flash of the other
// mode. Defaults to light (this app's default) when nothing is stored yet.
const THEME_INIT_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem('theme');
    if (stored === 'dark') document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const cinzel = Cinzel({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-cinzel' })

export const metadata: Metadata = {
  title: 'Nine-Oh-Four · Trick-Taking Card Game',
  description:
    'A responsive trick-taking card game prototype with counter-claim bidding, hidden trump, and a strict 904-point target.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1f4436' },
  ],
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const session = await auth()
  return (
    <html lang="en" className={`${geist.variable} ${cinzel.variable} bg-background`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <AuthBar userName={session?.user?.name ?? null} />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

function AuthBar({ userName }: { userName: string | null }) {
  return (
    <div className="relative z-40 flex items-center justify-end gap-2 border-b border-border/60 bg-background px-3 py-1.5 font-mono text-[11px]">
      <ThemeToggle />
      {userName ? (
        <>
          <span className="hidden text-muted-foreground sm:inline">{userName}</span>
          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/' })
            }}
          >
            <button
              type="submit"
              className="rounded-full border border-border bg-background/60 px-3 py-1 text-muted-foreground transition-colors hover:border-gold hover:text-gold"
            >
              Log out
            </button>
          </form>
        </>
      ) : (
        <>
          <a
            href="/login"
            className="rounded-full border border-border bg-background/60 px-3 py-1 text-muted-foreground transition-colors hover:border-gold hover:text-gold"
          >
            Log in
          </a>
          <a
            href="/register"
            className="rounded-full border border-gold/50 bg-background/60 px-3 py-1 text-gold transition-colors hover:bg-gold/10"
          >
            Sign up
          </a>
        </>
      )}
    </div>
  )
}
