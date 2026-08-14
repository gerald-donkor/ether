import { auth, currentUser } from "@clerk/nextjs/server";

import { readAccountExport } from "@/lib/db/account";

/**
 * `GET /account/export` — everything Ether stores about the signed-in owner, as
 * one JSON attachment.
 *
 * **This is a stated deviation from AGENTS.md 6.1**, which reserves Route
 * Handlers for external callers, and it is recorded in docs/backend.md rather
 * than passed over. The argument: 6.2's hard boundary is about *mutations*, and
 * this handler mutates nothing. An export is a read that has to answer with a
 * non-HTML content type and a download disposition, which a Server Component
 * cannot do and a Server Action cannot do without shipping the whole payload
 * into the browser as a string and building a `blob:` URL in client code. The
 * handler stays thin: session, one call into `lib/db/`, serialise.
 *
 * It is a JSON manifest carrying image **urls**, not a zip of image bytes.
 * Bundling megabytes of Blob objects through a function is a different problem
 * with a memory and duration budget, and the urls are directly fetchable for as
 * long as the account exists.
 *
 * Node.js runtime, dynamic. Never `runtime = "edge"` (AGENTS.md 7.5).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bumped when the payload's shape changes, so an old file stays legible. */
const EXPORT_VERSION = 2;

export async function GET() {
  // The owner comes from the session. There is no query parameter naming a
  // user, and one arriving is ignored: nothing here reads the request.
  const { userId } = await auth();
  if (!userId) {
    // A plain JSON 401, not a redirect and not an HTML error page: the caller
    // asked for a file.
    return Response.json({ error: "Sign in to export your data." }, {
      status: 401,
      headers: { "cache-control": "no-store" },
    });
  }

  let user;
  let data;
  try {
    [user, data] = await Promise.all([currentUser(), readAccountExport(userId)]);
  } catch (error) {
    // Nothing from the payload is logged. It is prompts and an email address,
    // which AGENTS.md 8.3 rule 2 puts off-limits to the console entirely, so
    // only the error's name goes out.
    console.error(
      "Account export read failed.",
      error instanceof Error ? error.name : "Unknown error",
    );
    return Response.json({ error: "Your export could not be built." }, {
      status: 500,
      headers: { "cache-control": "no-store" },
    });
  }

  const email =
    user?.emailAddresses.find(
      (address) => address.id === user?.primaryEmailAddressId,
    )?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    null;

  const generatedAt = new Date();

  const payload = {
    version: EXPORT_VERSION,
    generatedAt: generatedAt.toISOString(),
    account: {
      userId,
      email,
      joinedAt: user ? new Date(user.createdAt).toISOString() : null,
    },
    // Every generation, including removed and taken-down ones. A removed row is
    // still the owner's data.
    generations: data.generations.map((generation) => ({
      id: generation.id,
      prompt: generation.prompt,
      imageUrl: generation.imageUrl,
      model: generation.model,
      width: generation.width,
      height: generation.height,
      visibility: generation.visibility,
      createdAt: generation.createdAt.toISOString(),
      deletedAt: generation.deletedAt?.toISOString() ?? null,
      takedownAt: generation.takedownAt?.toISOString() ?? null,
      takedownReason: generation.takedownReason ?? null,
    })),
    usageEvents: data.usageEvents.map((event) => ({
      id: event.id,
      model: event.model,
      imageCount: event.imageCount,
      providerUnits: event.providerUnits,
      createdAt: event.createdAt.toISOString(),
    })),
    preferences: data.preferences
      ? {
          model: data.preferences.defaultModel,
          size: data.preferences.defaultSize,
          count: data.preferences.defaultCount,
          visibility: data.preferences.defaultVisibility,
          createdAt: data.preferences.createdAt.toISOString(),
          updatedAt: data.preferences.updatedAt.toISOString(),
        }
      : null,
    // Only reports this owner filed, by category and date. Reports filed
    // against their images are somebody else's data and never cross.
    reportsFiled: data.reportsFiled.map((report) => ({
      category: report.category,
      createdAt: report.createdAt.toISOString(),
    })),
    billing: data.billing,
  };

  const filename = `ether-export-${generatedAt.toISOString().slice(0, 10)}.json`;

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
