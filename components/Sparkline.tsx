"use client";

/**
 * Micro trend line: top-set kg (or reps for bodyweight moves) across the last
 * sessions, oldest → newest. Single series, so identity comes from the section
 * title; the real values sit in the list right below it (the "table view").
 */
interface SparklineProps {
  values: number[];
  unit: string;
}

const W = 96;
const H = 30;
const PAD = 4;

export function Sparkline({ values, unit }: SparklineProps) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;

  const x = (i: number) => PAD + (i * (W - PAD * 2)) / (values.length - 1);
  const y = (v: number) =>
    span === 0 ? H / 2 : H - PAD - ((v - min) * (H - PAD * 2)) / span;

  const points = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const last = values[values.length - 1];

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Top set trend: ${values.join(", ")} ${unit}`}
      className="shrink-0"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={x(values.length - 1)} cy={y(last)} r="3" fill="var(--color-accent)" />
    </svg>
  );
}
