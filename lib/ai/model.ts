import "server-only";

/**
 * Verified against Cloudflare's live model page on 2026-08-13:
 * https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/
 *
 * Chosen because it is an image model covered by Workers AI's free daily
 * neuron allocation, and the Free plan refuses further work rather than
 * billing for it. No payment method is required to serve a request.
 */
export const IMAGE_MODEL = "@cf/black-forest-labs/flux-1-schnell";
