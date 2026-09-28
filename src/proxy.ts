import { NextResponse, type NextRequest } from 'next/server'

/**
 * Proxy / Middleware corporativo para segregação de segurança:
 * - Área Pública: /, /reportar (Acesso livre com proteções locais)
 * - Área Privada: /dashboard/* (Acesso estritamente autenticado com RBAC)
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = request.cookies.get('saas_session')?.value

  // Se estiver tentando aceder ao login mas já tiver sessão ativa
  if (pathname === '/login') {
    if (sessionToken) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // Proteção das rotas administrativas e operacionais
  if (pathname.startsWith('/dashboard')) {
    if (!sessionToken) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const response = NextResponse.next()
    response.headers.set('x-user-auth', 'true')
    return response
  }

  return NextResponse.next()
}

export const middleware = proxy

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}
