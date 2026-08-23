import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchTags } from '../api/lookups';
import type { Tag } from '../api/types';

export function TagPicker({ selected, onChange }: { selected: Tag[]; onChange: (tags: Tag[]) => void }) {
  const [query, setQuery] = useState('');
  const { data: results } = useQuery({
    queryKey: ['tag-search', query],
    queryFn: () => searchTags(query),
    enabled: query.length > 1,
  });

  function addTag(tag: Tag) {
    if (!selected.some((t) => t.id === tag.id)) onChange([...selected, tag]);
    setQuery('');
  }

  function removeTag(id: number) {
    onChange(selected.filter((t) => t.id !== id));
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {selected.map((tag) => (
          <span key={tag.id} className="badge" style={{ background: 'var(--brand-wash)', color: 'var(--brand)' }}>
            {tag.name}{' '}
            <button type="button" onClick={() => removeTag(tag.id)} style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--brand)' }}>×</button>
          </span>
        ))}
      </div>
      <input
        type="text"
        placeholder="Search tags…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ height: 34, padding: '0 10px', border: '1px solid var(--border-strong)', width: '100%' }}
      />
      {results && results.length > 0 && (
        <div style={{ border: '1px solid var(--border)', marginTop: 4, maxHeight: 160, overflowY: 'auto' }}>
          {results.map((tag) => (
            <div
              key={tag.id}
              onClick={() => addTag(tag)}
              style={{ padding: '8px 10px', cursor: 'pointer', fontSize: 13 }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {tag.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
