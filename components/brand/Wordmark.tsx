/**
 * The Ether wordmark. Tektur 500 reproduces the reference's chamfered
 * letterforms exactly, so this is set as live text rather than shipped as a
 * path: it stays selectable, scales cleanly and costs nothing extra.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-brand text-text text-[22px] leading-none tracking-tight sm:text-[26px] ${className}`}
    >
      Ether
    </span>
  );
}
