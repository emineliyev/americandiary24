import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchPage, updatePage } from '../../api/pages';
import type { PageWritePayload } from '../../api/types';
import { CKEditorBody } from '../../components/CKEditorBody';
import { useToast, errorMessage } from '../../components/toast/ToastContext';
import { useFormValidation, required } from '../../utils/validation';

export function PageFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const { data: existing } = useQuery({
    queryKey: ['page', id],
    queryFn: () => fetchPage(Number(id)),
  });

  const [form, setForm] = useState<PageWritePayload>({
    title: '', body: '', meta_title: '', meta_description: '', is_active: true,
  });
  const [saving, setSaving] = useState(false);
  // Same CKEditor mount-timing guard as ArticleFormPage's Body field — see
  // that component for why formReady + resetKey both matter here.
  const [formReady, setFormReady] = useState(false);

  const { fieldError, fieldClass, touch, touchAll, isValid } = useFormValidation(form, {
    title: required('Title'),
  });

  useEffect(() => {
    if (existing) {
      setForm({
        title: existing.title, body: existing.body,
        meta_title: existing.meta_title, meta_description: existing.meta_description,
        is_active: existing.is_active,
      });
      setFormReady(true);
    }
  }, [existing]);

  function updateField<K extends keyof PageWritePayload>(key: K, value: PageWritePayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
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
      await updatePage(Number(id), form);
      toast.success('Page saved.');
      navigate('/pages');
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to save this page.'));
    } finally {
      setSaving(false);
    }
  }

  if (!formReady) {
    return <p>Loading…</p>;
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ maxWidth: 800 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22 }}>{existing ? existing.title : 'Edit Page'}</h1>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Title</label>
          <input
            type="text"
            className={fieldClass('title')}
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
            onBlur={() => touch('title')}
          />
          {fieldError('title') && <p className="field-error">{fieldError('title')}</p>}
        </div>
        <div className="checkbox-field">
          <input
            type="checkbox"
            id="is_active"
            checked={form.is_active}
            onChange={(e) => updateField('is_active', e.target.checked)}
          />
          <label htmlFor="is_active">Active</label>
        </div>
        <p className="field-hint" style={{ marginTop: -8, marginBottom: 16 }}>
          Unchecking this hides the page on the live site (404) and removes it from the footer, without deleting it here.
        </p>
        <div className="field">
          <label>Body</label>
          <CKEditorBody
            value={form.body}
            onChange={(html) => updateField('body', html)}
            resetKey={id ?? 'new'}
          />
          <p className="field-hint">Leave blank and the page shows "Content coming soon." on the live site.</p>
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>SEO</h2>
        <div className="field">
          <label>Meta Title</label>
          <input type="text" value={form.meta_title} onChange={(e) => updateField('meta_title', e.target.value)} />
          <p className="field-hint">Falls back to the page title if left blank.</p>
        </div>
        <div className="field">
          <label>Meta Description</label>
          <textarea rows={2} maxLength={300} value={form.meta_description} onChange={(e) => updateField('meta_description', e.target.value)} />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  );
}
