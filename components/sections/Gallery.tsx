import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/motion/Reveal";
import { ColumnDrift } from "@/components/motion/ColumnDrift";
import {
  getPublicGalleryImages,
  type PublicGalleryImage,
} from "@/lib/db/queries";

/**
 * The strip's repeating unit: four columns alternating between a full-height
 * photograph and a stacked pair. The 48,000 tile is what keeps this from
 * reading as a stock-photo wall.
 *
 * Square corners are the one radius exception on the page. The tiles butt
 * edge to edge, and any rounding would read as a gap. See design-system.md 1.5.
 */
type Tile =
  | {
      kind: "photo";
      src: string;
      alt: string;
      w: number;
      h: number;
      /** True for a Blob image, which needs `sizes` the local rasters do not. */
      remote?: boolean;
    }
  | { kind: "data" };

/**
 * A stacked column also scrolls on its own axis. Directions oppose and the
 * durations are deliberately unequal, so the two stacks never settle into a
 * lockstep that reads as one sliding sheet. Full-height columns carry no
 * drift and stay still, which is what makes the contrast legible.
 */
type Column = {
  tiles: Tile[];
  drift?: { direction: "up" | "down"; duration: number };
};

const COLUMNS: Column[] = [
  {
    drift: { direction: "down", duration: 26 },
    tiles: [
      { kind: "data" },
      {
        kind: "photo",
        src: "/assets/ui/img/gallery-bruges.jpg",
        alt: "Stepped gable houses along a canal at dusk.",
        w: 600,
        h: 450,
      },
    ],
  },
  {
    tiles: [
      {
        kind: "photo",
        src: "/assets/ui/img/gallery-coast.jpg",
        alt: "A tidal pool below a cliff at sunset, its wall covered in graffiti.",
        w: 1200,
        h: 628,
      },
    ],
  },
  {
    drift: { direction: "up", duration: 22 },
    tiles: [
      {
        kind: "photo",
        src: "/assets/ui/img/gallery-truck.jpg",
        alt: "A turquoise pickup truck parked under a filling station canopy.",
        w: 482,
        h: 600,
      },
      {
        kind: "photo",
        src: "/assets/ui/img/gallery-crowd.jpg",
        alt: "A performer lit in violet on a club stage.",
        w: 1200,
        h: 1800,
      },
    ],
  },
  {
    tiles: [
      {
        kind: "photo",
        src: "/assets/ui/img/gallery-snow.jpg",
        alt: "A track through snow-covered pines.",
        w: 600,
        h: 840,
      },
    ],
  },
];

/**
 * How many photographs one pass of the strip holds, counted off the columns
 * rather than written down, so the public read can never ask for more slots
 * than exist or leave one unconsidered.
 */
const PHOTO_SLOT_COUNT = COLUMNS.reduce(
  (total, column) =>
    total + column.tiles.filter((tile) => tile.kind === "photo").length,
  0,
);

/**
 * The query deliberately does not read prompts, so there is nothing true to
 * say about what any of these images shows. This says what the application
 * actually knows and claims no subject.
 */
const PUBLIC_ALT = "An image generated with Ether and published by its owner.";

/** The column widths below, so a Blob image requests the size it renders at. */
const REMOTE_SIZES = "(min-width: 1024px) 340px, (min-width: 640px) 280px, 220px";

/**
 * The curation rule, in full: newest public generations first, dropped into
 * the photographic slots in the order the strip already renders them. Every
 * slot the database does not fill keeps its artboard image, so zero through
 * five public rows all produce a complete strip. The 48,000 tile is not a
 * photographic slot and never comes from the database.
 */
function withPublicImages(images: PublicGalleryImage[]): Column[] {
  if (images.length === 0) return COLUMNS;

  let slot = 0;

  return COLUMNS.map((column) => ({
    ...column,
    tiles: column.tiles.map((tile) => {
      if (tile.kind !== "photo") return tile;

      const image = images[slot++];
      if (!image) return tile;

      return {
        kind: "photo" as const,
        src: image.imageUrl,
        alt: PUBLIC_ALT,
        w: image.width,
        h: image.height,
        remote: true,
      };
    }),
  }));
}

/** Pass A then pass B, the vertical counterpart of the track's two passes. */
const PASSES = [0, 1];

const COLUMN_WIDTH = "mr-1 w-[220px] shrink-0 sm:w-[280px] lg:w-[340px]";

/**
 * Against the stack's `200%` height this is `(H / 2) - 4px` plus a 4px margin,
 * so one pass of two tiles measures exactly `H` and the stack measures exactly
 * `2H`. Margins rather than flex `gap`, for the same reason the track uses
 * them: two passes must measure exactly twice one pass or the loop shows a seam.
 */
const STACK_TILE = "mb-1 h-[calc(25%-4px)] shrink-0";

function DataTile() {
  return (
    <div className="bg-surface flex h-full min-h-[150px] flex-col items-center justify-center px-6 text-center">
      <p className="text-lime text-[30px] leading-none font-medium">48,000</p>
      <p className="text-text-3 mt-3 max-w-[20ch] text-[11px] leading-[1.6] font-medium tracking-[0.12em] uppercase">
        Images generated by artificial intelligence
      </p>
    </div>
  );
}

/**
 * A column that scrolls vertically. The outer element is the viewport and
 * keeps the column's place in the flex row, so the horizontal drift is
 * untouched; the inner stack is what GSAP moves.
 */
function StackedColumn({
  column,
  hidden,
}: {
  column: Column & { drift: NonNullable<Column["drift"]> };
  hidden: boolean;
}) {
  return (
    <div
      aria-hidden={hidden || undefined}
      className={`relative overflow-hidden ${COLUMN_WIDTH}`}
    >
      <div
        data-column-drift={column.drift.direction}
        data-drift-duration={column.drift.duration}
        className="flex h-[200%] flex-col will-change-transform"
      >
        {PASSES.map((pass) =>
          column.tiles.map((tile, ti) => {
            // The second pass is the loop's seam filler. It repeats what pass
            // A already said, so it is hidden from assistive technology.
            const repeat = pass === 1;

            return tile.kind === "data" ? (
              <div
                key={`${pass}-${ti}`}
                aria-hidden={repeat || undefined}
                className={STACK_TILE}
              >
                <DataTile />
              </div>
            ) : (
              <Image
                key={`${pass}-${ti}`}
                src={tile.src}
                alt={hidden || repeat ? "" : tile.alt}
                aria-hidden={repeat || undefined}
                width={tile.w}
                height={tile.h}
                sizes={tile.remote ? REMOTE_SIZES : undefined}
                className={`${STACK_TILE} w-full object-cover`}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}

/**
 * Gaps are margins rather than flex `gap`, so that two passes of this track
 * measure exactly twice one pass and the -50% loop lands seamlessly.
 */
function Track({
  columns,
  hidden = false,
}: {
  columns: Column[];
  hidden?: boolean;
}) {
  return (
    <>
      {columns.map((column, ci) =>
        column.drift ? (
          <StackedColumn
            key={ci}
            column={{ ...column, drift: column.drift }}
            hidden={hidden}
          />
        ) : (
          <div
            key={ci}
            aria-hidden={hidden || undefined}
            className={`flex flex-col gap-1 ${COLUMN_WIDTH}`}
          >
            {column.tiles.map((tile, ti) =>
              tile.kind === "data" ? (
                <div key={ti} className="min-h-0 flex-1">
                  <DataTile />
                </div>
              ) : (
                <Image
                  key={ti}
                  src={tile.src}
                  alt={hidden ? "" : tile.alt}
                  width={tile.w}
                  height={tile.h}
                  sizes={tile.remote ? REMOTE_SIZES : undefined}
                  className="min-h-0 w-full flex-1 object-cover"
                />
              ),
            )}
          </div>
        ),
      )}
    </>
  );
}

export async function Gallery() {
  // The read is the section's own, so the landing page composes unchanged.
  // A missing database or a failed read resolves to the artboard strip.
  const columns = withPublicImages(
    await getPublicGalleryImages(PHOTO_SLOT_COUNT),
  );

  return (
    <section aria-labelledby="gallery-title" className="pb-24 md:pb-32">
      <Container>
        <Reveal>
          <h2
            id="gallery-title"
            className="text-text text-[clamp(26px,4vw,34px)] leading-[1.4] tracking-[-0.01em]"
          >
            Journey Through Art of community
          </h2>
        </Reveal>
      </Container>

      {/* Full bleed, past both viewport edges. */}
      <ColumnDrift>
        <div className="group mt-10 overflow-hidden">
          <div className="flex h-[420px] w-max motion-safe:animate-(--animate-drift) motion-safe:group-hover:[animation-play-state:paused] md:h-[520px]">
            <Track columns={columns} />
            {/* The second pass is what makes the loop seamless. It carries no
                information, so it is hidden from assistive technology. */}
            <Track columns={columns} hidden />
          </div>
        </div>
      </ColumnDrift>
    </section>
  );
}
