import { GithubLogo } from "@phosphor-icons/react/dist/ssr/GithubLogo";
import { InstagramLogo } from "@phosphor-icons/react/dist/ssr/InstagramLogo";
import { TelegramLogo } from "@phosphor-icons/react/dist/ssr/TelegramLogo";
import { XLogo } from "@phosphor-icons/react/dist/ssr/XLogo";
import { YoutubeLogo } from "@phosphor-icons/react/dist/ssr/YoutubeLogo";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { Container } from "@/components/ui/Container";

const SOCIALS = [
  { Icon: InstagramLogo, name: "Instagram" },
  { Icon: XLogo, name: "X" },
  { Icon: YoutubeLogo, name: "YouTube" },
  { Icon: GithubLogo, name: "GitHub" },
  { Icon: TelegramLogo, name: "Telegram" },
];

type FooterDestination = {
  label: string;
  href: string;
};

const COLUMNS: ReadonlyArray<{
  title: string;
  links: ReadonlyArray<FooterDestination>;
}> = [
  {
    title: "Ether",
    links: [
      { label: "Grants", href: "/grants" },
      { label: "Generator", href: "/generator" },
      { label: "Careers", href: "/careers" },
      { label: "Disclaimer", href: "/disclaimer" },
    ],
  },
  {
    title: "Get connected",
    links: [
      { label: "Services", href: "/services" },
      { label: "Blog", href: "/blog" },
      { label: "Newsletter", href: "/newsletter" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-ink-raised mt-auto py-16 md:py-20">
      <Container width="wide">
        <div className="flex flex-col gap-12 md:flex-row md:justify-between md:gap-8">
          <div>
            <Wordmark />
            <p className="text-text mt-3 text-[13px] font-medium">
              Managed by Artificial Intelligence
            </p>
            <ul className="mt-5 flex items-center gap-4">
              {/* Verified account URLs are required before these become links. */}
              {SOCIALS.map(({ Icon, name }) => (
                <li key={name} className="text-text-3 inline-flex">
                  <span aria-hidden="true">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-16 sm:gap-24">
            {COLUMNS.map((col) => (
              <nav key={col.title} aria-label={col.title}>
                <h2 className="text-text text-[12px] font-medium tracking-[0.12em] uppercase">
                  {col.title}
                </h2>
                <ul className="mt-5 flex flex-col gap-3">
                  {col.links.map(({ label, href }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        className="text-text-3 hover:text-text text-[14px] transition-colors"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
      </Container>
    </footer>
  );
}
