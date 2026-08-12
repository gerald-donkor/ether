/**
 * The abstract brand mark from the hero's violet block: a dark bolt, a white
 * triangle, a lime asterisk and a violet dot.
 *
 * These four paths are lifted verbatim from AI Generator.svg and then rounded
 * to one decimal place. Nothing here is drawn by hand.
 *
 * Each path sits in a `<g data-mark-shape>` carrying a `<g data-mark-bump>`,
 * and the four share a `<g data-mark-group>`. Those wrappers are what
 * `MarkSpiral` transforms, so the path data never has to know it is being
 * animated and this stays a server component. Two nested wrappers because the
 * orbit and the recoil off another shape are separate forces that have to be
 * able to run at once without fighting over the same `x`/`y`.
 *
 * The viewBox is the drawing's own box grown by 24 units left and right and 12
 * up and down: that margin is the headroom for both, and every amplitude in
 * `MarkSpiral` is budgeted against it.
 */
export function Mark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="921 536 426 221"
      className={className}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g data-mark-group>
        <g data-mark-shape="triangle">
          <g data-mark-bump>
            <path d="M1080.7 617L1153.5 743H1008L1080.7 617Z" fill="#fff" />
          </g>
        </g>
        <g data-mark-shape="bolt">
          <g data-mark-bump>
            <path
              d="M1098.8 592.2L1065.7 565.9L1044.1 593.1L990.1 550.2L963.8 583.2L1017.8 626.1L946 716.5L979 742.7L1098.8 592.2Z"
              fill="#040c1f"
            />
          </g>
        </g>
        <g data-mark-shape="asterisk">
          <g data-mark-bump>
            <path
              d="M1233.4 615.9C1223.7 618.1 1217.6 627.8 1219.9 637.5C1222.1 647.2 1231.8 653.2 1241.5 651C1251.2 648.8 1257.2 639.1 1255 629.4C1252.8 619.7 1243.1 613.6 1233.4 615.9ZM1273.4 709.5L1238.2 717.5L1223.9 655L1161.4 669.4L1153.3 634.2L1215.8 619.9L1201.5 557.4L1236.7 549.3L1251 611.8L1313.5 597.5L1321.5 632.7L1259 647L1273.4 709.5Z"
              fill="#d2ff3a"
            />
          </g>
        </g>
        <g data-mark-shape="dot">
          <g data-mark-bump>
            <path
              d="M1229.1 725C1229.1 735 1221 743.1 1211 743.1C1201.1 743.1 1193 735 1193 725C1193 715.1 1201.1 707 1211 707C1221 707 1229.1 715.1 1229.1 725Z"
              fill="#6843ec"
            />
          </g>
        </g>
      </g>
    </svg>
  );
}
