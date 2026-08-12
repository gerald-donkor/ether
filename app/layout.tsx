import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";
import { Outfit, Tektur } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

/* Bound to the wordmark only. See design-system.md 1.3. */
const tektur = Tektur({
  variable: "--font-tektur",
  subsets: ["latin"],
  weight: ["500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ether. Naturally image generator",
  description:
    "AI image generation for artists, writers and designers. Describe what you want and Ether renders it in seconds.",
};

/* Matches --color-ink, so the browser chrome does not seam against the page. */
export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${tektur.variable} h-full antialiased`}
    >
      <body className="bg-ink text-text flex min-h-full flex-col overflow-x-hidden">
        <ClerkProvider
          afterSignOutUrl="/"
          appearance={{
            variables: {
              colorPrimary: "var(--color-lime)",
              colorPrimaryForeground: "var(--color-ink)",
              colorForeground: "var(--color-text)",
              colorMutedForeground: "var(--color-text-3)",
              colorBackground: "var(--color-surface)",
              colorInput: "var(--color-surface-2)",
              colorInputForeground: "var(--color-text)",
              colorBorder: "var(--color-line)",
              colorRing: "var(--color-lime)",
              fontFamily: "var(--font-outfit)",
              fontFamilyButtons: "var(--font-outfit)",
              borderRadius: "var(--radius-panel)",
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
