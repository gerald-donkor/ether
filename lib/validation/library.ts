import { z } from "zod";

/**
 * The library's three query parameters. Like `generation.ts`, this module is
 * deliberately not server-only and imports nothing from `lib/db/`: the page
 * parses with it on the server and the form names its fields from the same
 * constants, so the rules exist once (AGENTS.md 6.3).
 *
 * Every field falls back rather than throwing. These arrive in a URL, and a
 * mistyped or hand-edited one must render the default view instead of a 500.
 */

/** The field names, so the form, the links and the parser cannot drift. */
export const SEARCH_FIELD = "q";
export const PAGE_FIELD = "page";
export const VIEW_FIELD = "view";

export const LIBRARY_VIEWS = ["active", "removed"] as const;
export type LibraryView = (typeof LIBRARY_VIEWS)[number];

/**
 * 20 is a choice, not a measurement: a round number that fills the ledger
 * without a second screen of scrolling, and one constant to change.
 */
export const LIBRARY_PAGE_SIZE = 20;

/**
 * An upper bound on the page number, because `offset` grows with it and a
 * hand-edited `?page=1000000` should cost nothing. Past the end the page
 * renders its empty state.
 */
const MAX_PAGE = 500;

const searchSchema = z
  .string()
  .trim()
  // The same 500 the prompt itself is capped at. A search term longer than
  // any prompt can be is not a search.
  .max(500)
  .catch("");

const pageSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_PAGE)
  .catch(1);

const viewSchema = z.enum(LIBRARY_VIEWS).catch("active");

export type LibraryQuery = {
  search: string;
  page: number;
  view: LibraryView;
};

/**
 * `searchParams` hands each value as a string, an array of strings, or
 * undefined. An array means the parameter was repeated in the URL; the first
 * value wins rather than the whole thing being rejected.
 */
function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseLibraryQuery(params: {
  [key: string]: string | string[] | undefined;
}): LibraryQuery {
  return {
    search: searchSchema.parse(first(params[SEARCH_FIELD]) ?? ""),
    page: pageSchema.parse(first(params[PAGE_FIELD]) ?? 1),
    view: viewSchema.parse(first(params[VIEW_FIELD]) ?? "active"),
  };
}

/**
 * One place that builds a library URL, so a link cannot drop the parameter it
 * was meant to preserve. Defaults are left out, which keeps `/library` itself
 * the canonical address of the first page.
 */
export function libraryHref({
  search,
  page,
  view,
}: Partial<LibraryQuery>): string {
  const params = new URLSearchParams();
  if (search) params.set(SEARCH_FIELD, search);
  if (view && view !== "active") params.set(VIEW_FIELD, view);
  if (page && page > 1) params.set(PAGE_FIELD, String(page));

  const query = params.toString();
  return query ? `/library?${query}` : "/library";
}
