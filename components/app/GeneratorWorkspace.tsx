"use client";

import { useActionState, useEffect, useRef } from "react";
import Image from "next/image";
import { PromptField } from "@/components/ui/PromptField";
import {
  generateGeneration,
  type GenerationActionState,
  type GenerationResult,
} from "@/app/(app)/generate/actions";

const INITIAL_STATE: GenerationActionState = {
  ok: null,
  error: null,
  generation: null,
};

export function GeneratorWorkspace({
  initialGenerations,
}: {
  initialGenerations: GenerationResult[];
}) {
  const [state, formAction, pending] = useActionState(
    generateGeneration,
    INITIAL_STATE,
  );
  const announcementRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.ok !== null) announcementRef.current?.focus();
  }, [state]);

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
          Write a concrete prompt. Ether will generate one image and keep it in
          your history.
        </p>
        <PromptField
          action={formAction}
          describedBy="generation-status"
          showPublishOption
          className="mt-8 max-w-[760px]"
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(240px,1fr)] lg:items-start">
          <div className="bg-surface rounded-panel relative aspect-square overflow-hidden">
            {state.generation ? (
              <Image
                src={state.generation.imageUrl}
                alt={state.generation.prompt}
                fill
                sizes="(max-width: 1023px) calc(100vw - 40px), 720px"
                className="object-cover"
              />
            ) : null}

            {pending ? (
              <div className="bg-ink/65 absolute inset-0 flex items-center justify-center">
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
              {pending
                ? "Generating your image."
                : state.error ??
                  (state.generation
                    ? state.generation.isPublic
                      ? "Image generated, saved, and published to the public gallery."
                      : "Image generated and saved. It stays private."
                    : "Your next image will appear here.")}
            </p>
            {state.generation ? (
              <p className="text-text-3 mt-4 text-[13px] leading-[22px]">
                {state.generation.prompt}
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
