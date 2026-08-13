import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher([
  "/generate(.*)",
  "/account(.*)",
  "/library(.*)",
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
    // Clerk's optional auth() on a public generation still needs middleware
    // context. This matcher runs Clerk without adding /g to isProtectedRoute.
    "/g/:path*",
  ],
};
