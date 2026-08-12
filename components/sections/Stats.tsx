import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/motion/Reveal";
import { StatCounter } from "@/components/motion/StatCounter";
import { z } from "@/lib/z";

/* Figures come from the reference artboard. Nothing here is invented. */
const STATS = [
  { value: 10.2, decimals: 1, suffix: "M+", label: "Active accounts" },
  { value: 300, decimals: 0, suffix: "+", label: "Projects" },
  { value: 1000, decimals: 0, suffix: "+", label: "Topics" },
];

export function Stats() {
  return (
    <section
      aria-labelledby="community-title"
      className="relative overflow-hidden py-24 md:py-40"
    >
      {/* Ambient arc. Decorative, capped in opacity, and it never rotates for
          anyone who asked for reduced motion. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-[46%] aspect-square w-[230%] max-w-[1750px] -translate-x-1/2 -translate-y-1/2 opacity-35 motion-safe:animate-[spin_40s_linear_infinite] md:w-[150%] lg:w-[132%]"
        style={{
          zIndex: z.atmosphere,
          background: "var(--grad-arc)",
          borderRadius: "9999px",
          mask: "radial-gradient(closest-side, transparent 79%, #000 81%, #000 83%, transparent 85%)",
          WebkitMask:
            "radial-gradient(closest-side, transparent 79%, #000 81%, #000 83%, transparent 85%)",
          filter: "blur(14px)",
        }}
      />

      <Container className="relative">
        <div className="grid gap-12 md:grid-cols-2 md:gap-8">
          <Reveal>
            <h2
              id="community-title"
              className="text-text max-w-[12ch] text-[clamp(30px,5vw,40px)] leading-[1.45] tracking-[-0.01em]"
            >
              Join a community of millions.
            </h2>
          </Reveal>

          <ul className="flex flex-col gap-10 md:gap-12">
            {STATS.map((s) => (
              <li key={s.label}>
                <Reveal>
                  <p className="text-grad-stat w-fit text-[clamp(48px,11vw,84px)] leading-none tracking-[-0.02em]">
                    <StatCounter
                      value={s.value}
                      decimals={s.decimals}
                      suffix={s.suffix}
                    />
                  </p>
                  <p className="text-text-3 mt-3 text-[12px] font-medium tracking-[0.12em] uppercase">
                    {s.label}
                  </p>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
