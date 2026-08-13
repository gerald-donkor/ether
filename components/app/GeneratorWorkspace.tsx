"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { PromptField } from "@/components/ui/PromptField";
import {
  choiceDimensions,
  DEFAULT_GENERATION_CHOICE,
  GenerationControls,
  type GenerationChoice,
} from "@/components/app/GenerationControls";
import {
  generateGeneration,
  type GenerationActionState,
  type GenerationResult,
} from "@/app/(app)/generate/actions";

const INITIAL_STATE: GenerationActionState = {
  ok: null,
  error: null,
  generations: [],
  failed: 0,
};

function countPhrase(count: number) {
  return `${count} ${count === 1 ? "image" : "images"}`;
}

function statusMessage(
  state: GenerationActionState,
  choice: GenerationChoice,
  pending: boolean,
) {
  if (pending) return `Generating ${countPhrase(choice.count)}.`;
  if (state.error) return state.error;
  if (state.ok !== true) return "Your next image will appear here.";

  const made = state.generations.length;
  const privacy = state.generations[0].isPublic
    ? "Published to the public gallery."
    : made === 1
      ? "It stays private."
      : "They stay private.";

  // A partial result is reported as one, rather than as a plain success that
  // quietly delivered fewer images than were asked for.
  const shortfall =
    state.failed > 0 ? ` ${countPhrase(state.failed)} failed.` : "";

  return `${countPhrase(made)} generated and saved.${shortfall} ${privacy}`;
}

export function GeneratorWorkspace({
  initialGenerations,
}: {
  initialGenerations: GenerationResult[];
}) {
  const [state, formAction, pending] = useActionState(
    generateGeneration,
    INITIAL_STATE,
  );
  const [choice, setChoice] = useState<GenerationChoice>(
    DEFAULT_GENERATION_CHOICE,
  );
  const announcementRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.ok !== null) announcementRef.current?.focus();
  }, [state]);

  // The slots exist before the response does, at the shape the controls asked
  // for, so the image arrives into a box that was already the right size. Once
  // images exist, each slot takes its own stored dimensions.
  const chosen = choiceDimensions(choice);
  const results = state.ok === true ? state.generations : [];
  const slotCount = results.length > 0 ? results.length : choice.count;
  const slots = Array.from(
    { length: slotCount },
    (_, index) => results[index] ?? null,
  );
  const slotSizes =
    slotCount > 1
      ? "(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) calc((100vw - 60px) / 2), 360px"
      : "(max-width: 1023px) calc(100vw - 40px), 720px";

  return (
    <div className="space-y-20">
      <section aria-labelledby="generator-title">
        <h1
          id="generator-title"
          className="text-text max-w-[14ch] text-[clamp(36px,7vw,64px)] leading-[1.2] font-normal tracking-[-0.01em]"
        >
          Describe the image you need.
        </h1>
        <p className="text-text-2 mt-5 max-w-[52ch] text-[15px] leading-[26px]">
          Write a concrete prompt, choose a model and a size, and Ether will keep
          the results in your history.
        </p>
        <PromptField
          action={formAction}
          describedBy="generation-status"
          controls={
            <GenerationControls choice={choice} onChange={setChoice} />
          }
          showPublishOption
          className="mt-8 max-w-[760px]"
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)] lg:items-start">
          <div className="relative">
            <div
              className={`grid gap-4 ${slotCount > 1 ? "sm:grid-cols-2" : ""}`}
            >
              {slots.map((slot, index) => (
                <div
                  key={slot?.id ?? `slot-${index}`}
                  className="bg-surface rounded-panel relative overflow-hidden"
                  style={{
                    aspectRatio: slot
                      ? `${slot.width} / ${slot.height}`
                      : `${chosen.width} / ${chosen.height}`,
                  }}
                >
                  {slot ? (
                    <Image
                      src={slot.imageUrl}
                      alt={slot.prompt}
                      fill
                      sizes={slotSizes}
                      className="object-cover"
                    />
                  ) : null}
                </div>
              ))}
            </div>

            {pending ? (
              <div className="bg-ink/65 rounded-panel absolute inset-0 flex items-center justify-center">
                <div
                  aria-hidden="true"
                  className="size-24 animate-spin rounded-pill p-[2px] opacity-50 motion-reduce:animate-none"
                  style={{ background: "var(--grad-arc)" }}
                >
                  <div className="bg-surface size-full rounded-pill" />
                </div>
              </div>
            ) : null}
          </div>

          <div className="pt-1">
            <p
              ref={announcementRef}
              id="generation-status"
              role="status"
              aria-live="polite"
              tabIndex={-1}
              className={state.ok === false ? "text-text" : "text-text-2"}
            >
              {statusMessage(state, choice, pending)}
            </p>
            {results.length > 0 ? (
              <p className="text-text-3 mt-4 text-[13px] leading-[22px]">
                {results[0].prompt}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section aria-labelledby="history-title">
        <h2
          id="history-title"
          className="text-text text-[clamp(28px,5vw,40px)] leading-[1.45] font-normal tracking-[-0.01em]"
        >
          Your recent images
        </h2>

        {initialGenerations.length > 0 ? (
          <ul className="mt-8 grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {initialGenerations.map((generation) => (
              <li key={generation.id}>
                <div className="rounded-card bg-surface relative aspect-square overflow-hidden">
                  <Image
                    src={generation.imageUrl}
                    alt={generation.prompt}
                    fill
                    sizes="(max-width: 639px) calc(100vw - 40px), (max-width: 1023px) calc((100vw - 60px) / 2), 347px"
                    className="object-cover"
                  />
                </div>
                <p className="text-text-2 mt-3 line-clamp-2 text-[13px] leading-[22px]">
                  {generation.prompt}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-3 mt-5 text-[15px]">
            Generate an image to start your history.
          </p>
        )}
      </section>
    </div>
  );
}
