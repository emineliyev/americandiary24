export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <p style={{ color: 'var(--text-muted)' }}>This section is planned for a later phase of the admin panel.</p>
    </div>
  );
}
