const PAGE_SIZE = 20; // matches REST_FRAMEWORK['PAGE_SIZE'] in config/settings.py

export function Pagination({
  page,
  count,
  hasPrevious,
  hasNext,
  onChange,
}: {
  page: number;
  count: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16 }}>
      <button className="btn" disabled={!hasPrevious} onClick={() => onChange(page - 1)}>← Prev</button>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        Page {page} of {totalPages}
      </span>
      <button className="btn" disabled={!hasNext} onClick={() => onChange(page + 1)}>Next →</button>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{count} total</span>
    </div>
  );
}
