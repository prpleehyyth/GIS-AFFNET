import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Namanya wajib 'proxy' atau 'default export' untuk Next.js 16
export function proxy(request: NextRequest) {
  // Ambil cookie dengan nama 'token' (Sesuai dengan yang dicetak backend Golang)
  const jwtToken = request.cookies.get('token')?.value;
  const path = request.nextUrl.pathname;

  const isLoginPage = path.startsWith('/login');

  // Tidak ada token & bukan halaman login → tendang ke /login
  if (!jwtToken && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Sudah punya token & malah buka /login atau / → arahkan ke /dashboard
  if (jwtToken && (isLoginPage || path === '/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Tentukan path mana saja yang mau dicegat sama proxy ini
  matcher: ['/', '/dashboard', '/map', '/odp', '/onu', '/login'],
};