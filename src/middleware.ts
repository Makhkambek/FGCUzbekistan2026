import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/constants';

export function middleware(req: NextRequest) {
  // The cookie presence is checked here; the signature is verified in the API/pages (Node runtime).
  if (!req.cookies.get(SESSION_COOKIE)) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*'] };
