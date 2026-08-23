import { useState } from 'react';

interface Point {
  date: string;
  count: number;
}

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { top: 16, right: 12, bottom: 26, left: 12 };

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Single time-series metric — a plain 2px line is the right form here (see
// the dataviz skill's choosing-a-form guidance), one hue (brand navy),
// no legend needed since the card title already names the series. Built
// as plain SVG rather than pulling in a charting library, matching this
// codebase's zero-dependency pattern for every other custom UI piece.
export function LineChart({ data }: { data: Point[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  const points = data.map((d, i) => ({
    ...d,
    x: PAD.left + i * stepX,
    y: PAD.top + innerH - (d.count / maxCount) * innerH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const hovered = hoverIndex !== null ? points[hoverIndex] : null;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: HEIGHT, display: 'block', overflow: 'visible' }}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={PAD.left} x2={WIDTH - PAD.right}
          y1={PAD.top + innerH * (1 - f)} y2={PAD.top + innerH * (1 - f)}
          stroke="var(--border)" strokeWidth={1}
        />
      ))}

      <path d={linePath} fill="none" stroke="var(--brand)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

      {points.map((p, i) => (
        <g key={p.date}>
          {/* wide invisible hit target — bigger than the mark, per the
              skill's interaction guidance */}
          <rect
            x={p.x - (stepX || innerW) / 2} y={0} width={stepX || innerW} height={HEIGHT}
            fill="transparent"
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex(null)}
          />
          <text x={p.x} y={HEIGHT - 8} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
            {formatDate(p.date)}
          </text>
        </g>
      ))}

      {hovered && (
        <>
          <line x1={hovered.x} x2={hovered.x} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--border-strong)" strokeWidth={1} strokeDasharray="3 3" />
          <circle cx={hovered.x} cy={hovered.y} r={4} fill="var(--brand)" stroke="#fff" strokeWidth={2} />
          {(() => {
            const boxW = 74;
            const boxX = Math.min(Math.max(hovered.x - boxW / 2, PAD.left), WIDTH - PAD.right - boxW);
            const boxY = Math.max(hovered.y - 34, 0);
            return (
              <g>
                <rect x={boxX} y={boxY} width={boxW} height={24} rx={3} fill="var(--text)" />
                <text x={boxX + boxW / 2} y={boxY + 16} textAnchor="middle" fontSize={11} fill="#fff">
                  {formatDate(hovered.date)} · {hovered.count}
                </text>
              </g>
            );
          })()}
        </>
      )}
    </svg>
  );
}
