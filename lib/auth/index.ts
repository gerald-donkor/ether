import "server-only";

import { auth } from "@clerk/nextjs/server";

export async function requireUserId() {
  const session = await auth.protect();
  return session.userId;
}
