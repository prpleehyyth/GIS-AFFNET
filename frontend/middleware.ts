import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// WAJIB bernama 'middleware', bukan 'proxy'
export function middleware(request: NextRequest) {
  // Ambil cookie 'token'
  const jwtToken = request.cookies.get('token')?.value;
  const path = request.nextUrl.pathname;

  const isLoginPage = path.startsWith('/login');

  // 1. PROTEKSI: Tidak ada token & mau akses halaman selain login
  if (!jwtToken && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 2. AUTO-REDIRECT: Sudah login tapi iseng buka halaman login lagi
  if (jwtToken && (isLoginPage || path === '/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

// Konfigurasi Matcher
export const config = {
  // Gunakan pola ini agar mencakup semua sub-halaman (seperti /dashboard/edit, dll)
  matcher: [
    '/',
    '/dashboard/:path*', 
    '/map/:path*', 
    '/odp/:path*', 
    '/onu/:path*', 
    '/login'
  ],
};