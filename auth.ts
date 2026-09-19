import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Facebook from 'next-auth/providers/facebook'
import type { DefaultSession } from 'next-auth'
import { FACEBOOK_LOGIN_ENABLED } from '@/lib/feature-flags'
import { verifyCredentials } from '@/lib/server/users'

declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & { id?: string }
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      name: 'Username and password',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      authorize(credentials) {
        const username = typeof credentials?.username === 'string' ? credentials.username : ''
        const password = typeof credentials?.password === 'string' ? credentials.password : ''
        if (!username || !password) return null
        const user = verifyCredentials(username, password)
        return user ? { id: user.id, name: user.username } : null
      },
    }),
    // Off until AUTH_FACEBOOK_ENABLED=true and real App ID/Secret are set —
    // see lib/feature-flags.ts. Registering the provider with empty
    // credentials would make next-auth throw on every request.
    ...(FACEBOOK_LOGIN_ENABLED
      ? [
          Facebook({
            clientId: process.env.AUTH_FACEBOOK_ID,
            clientSecret: process.env.AUTH_FACEBOOK_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.name = user.name
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.name = token.name
        session.user.id = token.sub as string
      }
      return session
    },
  },
})
