import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/generate(.*)",
  "/account(.*)",
  "/library(.*)",
  "/g(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/generate/:path*",
    "/account/:path*",
    "/library/:path*",
    "/g/:path*",
  ],
};
