/** A compact horizontal bar for a probability inside a table cell: the value as
 *  a filled bar, an optional interval as a whisker and an optional reference
 *  (e.g. the cohort base rate) as a tick. All on a scale shared by the column,
 *  so bars in one table compare directly. Decorative to assistive technology:
 *  the cell's text already states every number. */
export function InlineBar({
  value,
  max,
  color,
  lo,
  hi,
  reference,
}: {
  value: number;
  max: number;
  color: string;
  lo?: number;
  hi?: number;
  reference?: number;
}) {
  const at = (v: number) => `${Math.min(100, Math.max(0, (v / max) * 100))}%`;
  return (
    <span aria-hidden="true" className="relative block h-2.5 w-full min-w-[90px] rounded-full bg-slate-100">
      <span
        className="absolute inset-y-0 left-0 origin-left rounded-full animate-grow-x"
        style={{
          width: at(value),
          background: `linear-gradient(90deg, ${color}66, ${color})`,
        }}
      />
      {lo != null && hi != null && (
        <span
          className="absolute top-1/2 h-px -translate-y-1/2 bg-slate-700/70"
          style={{ left: at(lo), width: `calc(${at(hi)} - ${at(lo)})` }}
        >
          <span className="absolute -left-px -top-1 h-2.5 w-px bg-slate-700/70" />
          <span className="absolute -right-px -top-1 h-2.5 w-px bg-slate-700/70" />
        </span>
      )}
      {reference != null && (
        <span
          className="absolute -top-1 h-[18px] w-0.5 -translate-x-1/2 rounded bg-ink-800"
          style={{ left: at(reference) }}
          title="Cohort base rate"
        />
      )}
    </span>
  );
}
