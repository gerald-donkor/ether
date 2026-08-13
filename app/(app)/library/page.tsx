import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LibraryRowActions } from "@/components/app/LibraryRowActions";
import { Container } from "@/components/ui/Container";
import { getModel } from "@/lib/ai/catalog";
import { requireUserId } from "@/lib/auth";
import { listLibraryPage } from "@/lib/db/queries";
import {
  libraryHref,
  LIBRARY_PAGE_SIZE,
  parseLibraryQuery,
  SEARCH_FIELD,
  VIEW_FIELD,
  type LibraryView,
} from "@/lib/validation/library";

/**
 * A static title. Prompts are the user's data and a search term is a prompt
 * fragment, so neither reaches the browser tab or the history (AGENTS.md 8.3).
 */
export const metadata: Metadata = {
  title: "Library | Ether",
  description: "Every image you have generated, with search and removal.",
};

const dateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

const viewLink =
  "rounded-pill border px-4 py-2 text-[13px] font-medium transition-colors";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // The proxy is optimistic and is not the boundary, so the session is read
  // again here (AGENTS.md 11 rule 1).
  const userId = await requireUserId();

  // Awaiting this opts the route into dynamic rendering, which is correct: it
  // is one account's own work, filtered by their own query.
  const { search, page, view } = parseLibraryQuery(await searchParams);

  const { rows, hasMore } = await listLibraryPage({
    userId,
    search,
    page,
    pageSize: LIBRARY_PAGE_SIZE,
    removed: view === "removed",
  });

  return (
    <Container className="py-16 md:py-24">
      <section aria-labelledby="library-title">
        <h1
          id="library-title"
          className="text-text text-[clamp(36px,7vw,64px)] leading-[1.2] font-normal tracking-[-0.01em]"
        >
          Library
        </h1>
        <p className="text-text-2 mt-4 max-w-[52ch] text-[15px] leading-[26px]">
          Every image you have generated, newest first. Removing one takes it
          out of your library and out of the public gallery, and you can put it
          back.
        </p>

        <div className="mt-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          {/* A native GET form. The page reads its own query parameters on the
              server, so there is no client-side fetching here. */}
          <form method="get" action="/library" className="w-full max-w-[420px]">
            <label
              htmlFor="library-search"
              className="text-text-3 block text-[13px]"
            >
              Search your prompts
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                id="library-search"
                type="search"
                name={SEARCH_FIELD}
                defaultValue={search}
                maxLength={500}
                autoComplete="off"
                className="bg-surface-2 rounded-pill text-text placeholder:text-text-3 min-w-0 flex-1 px-5 py-2.5 text-[13px]"
                placeholder="A word from the prompt"
              />
              {/* The current view travels with the search, so searching inside
                  Removed stays in Removed. Paging resets by omission. */}
              <input type="hidden" name={VIEW_FIELD} value={view} />
              <button
                type="submit"
                className="rounded-pill border-line text-text hover:border-text-3 inline-flex items-center justify-center border px-5 py-2.5 text-[13px] font-medium whitespace-nowrap transition-transform duration-200 ease-(--ease-out) active:scale-[0.98]"
              >
                Search
              </button>
            </div>
          </form>

          <nav aria-label="Library view" className="flex items-center gap-2">
            <ViewSwitch current={view} target="active" search={search}>
              Your images
            </ViewSwitch>
            <ViewSwitch current={view} target="removed" search={search}>
              Removed
            </ViewSwitch>
          </nav>
        </div>

        {rows.length > 0 ? (
          <>
            <ul className="border-line divide-line mt-10 divide-y border-t">
              {rows.map((row) => {
                // A row written before lib/ai/catalog.ts existed can hold an
                // id the registry does not list, so the stored id is the
                // fallback rather than "undefined".
                const modelLabel = getModel(row.model)?.label ?? row.model;

                return (
                  <li
                    key={row.id}
                    className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-x-5 gap-y-4 py-6 sm:grid-cols-[64px_minmax(0,1fr)_auto]"
                  >
                    <div className="rounded-card bg-surface relative size-16 overflow-hidden">
                      <Image
                        src={row.imageUrl}
                        alt={row.prompt}
                        fill
                        sizes="64px"
                        className="object-cover"
                      />
                    </div>

                    <div className="min-w-0">
                      {view === "active" ? (
                        <Link
                          href={`/g/${row.id}`}
                          className="text-text hover:text-text-2 rounded-sm text-[15px] leading-[26px] transition-colors"
                        >
                          {row.prompt}
                        </Link>
                      ) : (
                        // The permalink 404s for a removed row by design, so
                        // the prompt is not a link here. The row's own actions
                        // are what it offers instead.
                        <p className="text-text-2 text-[15px] leading-[26px]">
                          {row.prompt}
                        </p>
                      )}
                      {/* Spacing separates the meta rather than a punctuation
                          mark, because the site uses none anywhere else. */}
                      <p className="text-text-3 mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px] leading-[22px]">
                        <span>{modelLabel}</span>
                        <span>
                          {row.width} x {row.height}
                        </span>
                        <span>{dateFormat.format(row.createdAt)}</span>
                        {row.isPublic && view === "active" ? (
                          <span>Public</span>
                        ) : null}
                      </p>
                    </div>

                    <div className="col-start-2 sm:col-start-3">
                      <LibraryRowActions id={row.id} view={view} />
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Page numbers are not invented. The rail says which page this is
                and whether there is another, which is what the `pageSize + 1`
                read actually knows. A total would need a count query. */}
            <nav
              aria-label="Pagination"
              className="border-line mt-8 flex items-center justify-between gap-4 border-t pt-6"
            >
              <PageLink
                href={libraryHref({ search, view, page: page - 1 })}
                enabled={page > 1}
              >
                Newer
              </PageLink>
              <p className="text-text-3 text-[13px]">Page {page}</p>
              <PageLink
                href={libraryHref({ search, view, page: page + 1 })}
                enabled={hasMore}
              >
                Older
              </PageLink>
            </nav>
          </>
        ) : (
          <p className="text-text-2 mt-10 max-w-[52ch] text-[15px] leading-[26px]">
            {emptyMessage(view, search, page)}
          </p>
        )}
      </section>
    </Container>
  );
}

function ViewSwitch({
  current,
  target,
  search,
  children,
}: {
  current: LibraryView;
  target: LibraryView;
  search: string;
  children: string;
}) {
  const active = current === target;

  return (
    <Link
      href={libraryHref({ search, view: target })}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? `${viewLink} border-text-3 text-text`
          : `${viewLink} border-line text-text-2 hover:text-text hover:border-text-3`
      }
    >
      {children}
    </Link>
  );
}

/**
 * Nowhere to go is plain text rather than a link that does nothing, so the
 * keyboard never stops on a dead control.
 */
function PageLink({
  href,
  enabled,
  children,
}: {
  href: string;
  enabled: boolean;
  children: string;
}) {
  if (!enabled) {
    return <span className="text-text-3 text-[13px]">{children}</span>;
  }

  return (
    <Link
      href={href}
      className="text-text hover:text-text-2 rounded-sm text-[13px] transition-colors"
    >
      {children}
    </Link>
  );
}

function emptyMessage(view: LibraryView, search: string, page: number) {
  if (page > 1) return "There is nothing on this page. Go back to the newer images.";
  if (search) return `No prompt here contains "${search}".`;
  if (view === "removed") return "You have not removed anything.";
  return "You have not generated anything yet.";
}
