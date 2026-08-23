interface Row {
  name: string;
  count: number;
  percent: number;
}

// Ranked magnitude, not categorical identity — every bar is the same hue
// (brand navy) and length encodes share, matching the reference's own
// "all-one-color" treatment. A rainbow-per-category palette would be
// wrong here since labels already carry identity; color would be doing
// nothing but adding noise.
export function CategoryBarList({ rows }: { rows: Row[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {rows.map((row) => (
        <div key={row.name}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
            <span>{row.name}</span>
            <span style={{ color: 'var(--text-muted)' }}>{row.percent}%</span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-alt)', position: 'relative' }}>
            <div
              style={{
                position: 'absolute', top: 0, left: 0, bottom: 0,
                width: `${Math.max(row.percent, row.percent > 0 ? 1.5 : 0)}%`,
                background: 'var(--brand)',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
