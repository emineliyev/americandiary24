import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { createCategory, fetchCategory, updateCategory } from '../../api/categories';
import type { CategoryWritePayload } from '../../api/types';
import { slugify } from '../../utils/slugify';
import { useToast, errorMessage } from '../../components/toast/ToastContext';
import { useFormValidation, required, slug as slugRule } from '../../utils/validation';

export function CategoryFormPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const toast = useToast();

  const { data: existing } = useQuery({
    queryKey: ['category', id],
    queryFn: () => fetchCategory(Number(id)),
    enabled: !isNew,
  });

  const [form, setForm] = useState<CategoryWritePayload>({ name: '', slug: '', order: 0, is_active: true });
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const { fieldError, fieldClass, touch, touchAll, isValid } = useFormValidation(form, {
    name: required('Name'),
    slug: slugRule('Slug'),
  });

  useEffect(() => {
    if (existing) {
      setForm({ name: existing.name, slug: existing.slug, order: existing.order, is_active: existing.is_active });
      setSlugTouched(true);
    }
  }, [existing]);

  function handleNameChange(name: string) {
    setForm((f) => ({ ...f, name }));
    if (!slugTouched) setForm((f) => ({ ...f, name, slug: slugify(name) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    touchAll();
    if (!isValid) {
      toast.error('Please fix the highlighted fields.');
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await createCategory(form);
      } else {
        await updateCategory(Number(id), form);
      }
      toast.success(isNew ? 'Category created.' : 'Category saved.');
      navigate('/categories');
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to save the category.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ maxWidth: 500 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22 }}>{isNew ? 'New Category' : 'Edit Category'}</h1>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>

      <div className="card">
        <div className="field">
          <label>Name</label>
          <input
            type="text"
            className={fieldClass('name')}
            value={form.name}
            onChange={(e) => handleNameChange(e.target.value)}
            onBlur={() => touch('name')}
          />
          {fieldError('name') && <p className="field-error">{fieldError('name')}</p>}
        </div>
        <div className="field">
          <label>Slug</label>
          <input
            type="text"
            className={fieldClass('slug')}
            value={form.slug}
            onChange={(e) => { setSlugTouched(true); setForm((f) => ({ ...f, slug: e.target.value })); }}
            onBlur={() => touch('slug')}
          />
          {fieldError('slug') && <p className="field-error">{fieldError('slug')}</p>}
        </div>
        <div className="field">
          <label>Order</label>
          <input type="number" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) }))} />
          <p className="field-hint">Lower numbers appear first in navigation and section ordering.</p>
        </div>
        <div className="checkbox-field">
          <input
            type="checkbox"
            id="is_active"
            checked={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
          />
          <label htmlFor="is_active">Active</label>
        </div>
      </div>
    </form>
  );
}
