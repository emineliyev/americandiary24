import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { createTag, fetchTag, updateTag } from '../../api/tags';
import type { TagWritePayload } from '../../api/types';
import { slugify } from '../../utils/slugify';
import { useToast, errorMessage } from '../../components/toast/ToastContext';
import { useFormValidation, required, slug as slugRule } from '../../utils/validation';

export function TagFormPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const toast = useToast();

  const { data: existing } = useQuery({
    queryKey: ['tag', id],
    queryFn: () => fetchTag(Number(id)),
    enabled: !isNew,
  });

  const [form, setForm] = useState<TagWritePayload>({ name: '', slug: '' });
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const { fieldError, fieldClass, touch, touchAll, isValid } = useFormValidation(form, {
    name: required('Name'),
    slug: slugRule('Slug'),
  });

  useEffect(() => {
    if (existing) {
      setForm({ name: existing.name, slug: existing.slug });
      setSlugTouched(true);
    }
  }, [existing]);

  function handleNameChange(name: string) {
    setForm((f) => ({ ...f, name, slug: slugTouched ? f.slug : slugify(name) }));
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
        await createTag(form);
      } else {
        await updateTag(Number(id), form);
      }
      toast.success(isNew ? 'Tag created.' : 'Tag saved.');
      navigate('/tags');
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to save the tag.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ maxWidth: 500 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22 }}>{isNew ? 'New Tag' : 'Edit Tag'}</h1>
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
      </div>
    </form>
  );
}
