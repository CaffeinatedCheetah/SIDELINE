import { NextResponse } from "next/server";

import { auth } from "@/auth";

export default auth((request) => {
  if (!request.auth) {
    const destination = new URL("/auth/sign-in", request.nextUrl.origin);
    destination.searchParams.set(
      "callbackUrl",
      request.nextUrl.pathname + request.nextUrl.search,
    );
    return NextResponse.redirect(destination);
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/arena/:path*",
    "/notifications/:path*",
    "/settings/:path*",
    "/onboarding/:path*",
  ],
};
