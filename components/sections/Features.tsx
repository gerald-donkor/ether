import { YoutubeLogo } from "@phosphor-icons/react/dist/ssr/YoutubeLogo";
import { SpotifyLogo } from "@phosphor-icons/react/dist/ssr/SpotifyLogo";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { PromptField } from "@/components/ui/PromptField";
import { Reveal } from "@/components/motion/Reveal";

export function Features() {
  return (
    <section aria-labelledby="features-title" className="pb-20 md:pb-28">
      <h2 id="features-title" className="sr-only">
        What Ether does
      </h2>

      <Container>
        <div className="grid gap-4 md:grid-cols-2">
          <Reveal className="h-full min-w-0">
            <article className="bg-surface rounded-panel flex h-full flex-col p-7 md:p-8">
              <h3 className="text-text max-w-[18ch] text-[22px] leading-[30px]">
                Automated Image Synthesis and Design
              </h3>
              <p className="text-text-2 mt-4 max-w-[46ch] text-[14px] leading-[24px]">
                With AI-powered image generation, designers and creatives can
                streamline their workflows and unlock new levels of efficiency.
              </p>

              <div className="mt-auto flex flex-wrap gap-3 pt-8">
                <Button variant="ghost" href="#" className="px-5 py-2.5 text-[12px] tracking-[0.08em] uppercase">
                  Youtube
                  <YoutubeLogo
                    size={18}
                    weight="fill"
                    className="text-youtube"
                    aria-hidden="true"
                  />
                </Button>
                <Button variant="ghost" href="#" className="px-5 py-2.5 text-[12px] tracking-[0.08em] uppercase">
                  Podcast
                  <SpotifyLogo
                    size={18}
                    weight="fill"
                    className="text-violet"
                    aria-hidden="true"
                  />
                </Button>
              </div>
            </article>
          </Reveal>

          <Reveal className="h-full min-w-0">
            <article className="bg-surface rounded-panel flex h-full flex-col p-7 md:p-8">
              <h3 className="text-text max-w-[18ch] text-[22px] leading-[30px]">
                Create stunning visual in seconds
              </h3>
              <p className="text-text-2 mt-4 max-w-[46ch] text-[14px] leading-[24px]">
                Generating innovative ideas is a crucial aspect of any creative
                endeavor. AI tools can help spark inspiration by analyzing vast
                amounts of data.
              </p>

              <div className="mt-auto">
                <PromptField />
              </div>
            </article>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
