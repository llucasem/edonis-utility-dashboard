import { NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/login', '/api/logout', '/privacy', '/eula']

export function middleware(request) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next()
  if (pathname.startsWith('/_next') || pathname.startsWith('/favicon')) return NextResponse.next()

  const session = request.cookies.get('tdm_session')?.value
  const expected = process.env.APP_SESSION_TOKEN

  if (!session || session !== expected) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
