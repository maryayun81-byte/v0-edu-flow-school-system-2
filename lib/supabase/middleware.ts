import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // This will refresh session if expired - required for Server Components
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  let user = null;
  let userRole = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
    
    if (user) {
        // Fetch role from profile for deeper protection
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();
        userRole = profile?.role;
    }
  } catch (error: any) {
    // If the refresh token is invalid/expired, clear the session and redirect to
    // the appropriate login page based on which portal made the request.
    if (error?.code === 'refresh_token_not_found' || error?.status === 400) {
      const pathname = request.nextUrl.pathname;
      let loginPath = '/admin/login';
      if (pathname.startsWith('/student')) loginPath = '/student/login';
      else if (pathname.startsWith('/teacher')) loginPath = '/teacher/login';

      const redirectResponse = NextResponse.redirect(new URL(loginPath, request.url));
      // Clear all Supabase auth cookies so the stale token is removed
      request.cookies.getAll().forEach(({ name }) => {
        if (name.startsWith('sb-')) {
          redirectResponse.cookies.delete(name);
        }
      });
      return redirectResponse;
    }
  }

  const pathname = request.nextUrl.pathname;

  // 1. Admin Protection
  if (pathname.startsWith('/admin')) {
      if (pathname === '/admin/login') {
          if (user && userRole === 'admin') {
              return NextResponse.redirect(new URL('/admin/dashboard', request.url));
          }
          return response;
      }
      if (!user || userRole !== 'admin') {
          return NextResponse.redirect(new URL('/admin/login', request.url));
      }
  }

  // 2. Student Protection
  if (pathname.startsWith('/student/dashboard')) {
      if (!user || userRole !== 'student') {
          return NextResponse.redirect(new URL('/student/login', request.url));
      }
  }

  // 3. Teacher Protection
  if (pathname.startsWith('/teacher/dashboard')) {
      if (!user || userRole !== 'teacher') {
          return NextResponse.redirect(new URL('/teacher/login', request.url));
      }
  }

  // 4. Redirect away from login if already authenticated with correct role
  if (pathname === '/student/login' && user && userRole === 'student') {
      return NextResponse.redirect(new URL('/student/dashboard', request.url));
  }
  if (pathname === '/teacher/login' && user && userRole === 'teacher') {
      return NextResponse.redirect(new URL('/teacher/dashboard', request.url));
  }

  return response;
}
