import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { createArticle, fetchArticle, updateArticle } from '../../api/articles';
import { fetchAuthors, fetchCategories } from '../../api/lookups';
import { CKEditorBody } from '../../components/CKEditorBody';
import { ImagePicker, type ImagePickerValue } from '../../components/ImagePicker';
import { ARTICLE_IMAGE_SIZE } from '../../utils/imageSizes';
import { TagPicker } from '../../components/TagPicker';
import type { ArticleStatus, ArticleWritePayload, Author, Tag } from '../../api/types';
import { useAuth } from '../../auth/AuthContext';
import { slugify } from '../../utils/slugify';
import { useToast, errorMessage } from '../../components/toast/ToastContext';
import { useFormValidation, required, requiredHtml, slug as slugRule } from '../../utils/validation';

const BOOLEAN_FIELDS: { key: keyof ArticleWritePayload; label: string; hint?: string }[] = [
  { key: 'is_main', label: 'Main', hint: 'Eligible for the homepage hero + "More Headlines" row (newest 5 shown). Unflagged articles never appear there, no matter how recent.' },
  { key: 'is_breaking', label: 'Breaking News' },
  { key: 'is_exclusive', label: 'Researches & Insights', hint: 'Featured in the "AmericanDiary24 Researches & Insights" section on the homepage (newest 3 shown).' },
  { key: 'is_editors_pick', label: "Editor's Pick" },
  { key: 'is_reference', label: 'Exclusive Opinion', hint: 'Featured in the "Exclusive Opinion" widget beside the homepage header (newest 4 shown).' },
  { key: 'is_indexed', label: 'Search-indexable', hint: 'Uncheck for syndicated/wire content — excludes it from sitemap.xml and adds noindex.' },
  { key: 'show_author_name', label: 'Show author name', hint: 'Uncheck to display "News Desk" instead of the author on this article.' },
];

export function ArticleFormPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const { data: categories } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  const { data: authors } = useQuery({ queryKey: ['authors'], queryFn: fetchAuthors });
  const { data: existing, isError: existingError } = useQuery({
    queryKey: ['article', id],
    queryFn: () => fetchArticle(Number(id)),
    enabled: !isNew,
    retry: false,
  });

  const [form, setForm] = useState<ArticleWritePayload>({
    title: '', slug: '', dek: '', body: '',
    meta_title: '', meta_description: '', image_credit: '',
    category_id: 0, author_id: 0, co_author_ids: [], tag_ids: [],
    status: 'draft', published_at: null,
    is_breaking: false, is_exclusive: false, is_editors_pick: false, is_reference: false, is_main: false,
    is_indexed: true, show_author_name: true,
  });
  const [tags, setTags] = useState<Tag[]>([]);
  const [coAuthors, setCoAuthors] = useState<Author[]>([]);
  const [slugTouched, setSlugTouched] = useState(false);
  const articleId = isNew ? null : Number(id);
  // Undefined id (-1) is fine here — it's only ever used for display via
  // ImagePicker's preview `url`; the real id is only read on submit, and
  // only when `imageTouched` (i.e. the picker was actually used this
  // session), so an existing article's already-set image never needs its
  // real asset id known just to be left alone.
  const [imageAsset, setImageAsset] = useState<ImagePickerValue | null>(null);
  const [imageTouched, setImageTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  // Guards when CKEditorBody is allowed to mount for an existing article.
  // `existing` arrives from the network one render before the `setForm`
  // effect below actually copies its body into `form.body` — mounting
  // CKEditorBody in that in-between render (keyed on the now-changed
  // resetKey but still fed the old, empty `form.body`) permanently bakes
  // in an empty editor, since CKEditor only reads its `data` prop at
  // mount. Waiting for `formReady` (flipped together with `setForm`, in
  // the same batch) means the very first mount already has the real body.
  const [formReady, setFormReady] = useState(isNew);

  // Almost everyone has a personal Author profile (Users always creates the
  // pair together) so a new article can just auto-assign to whoever's
  // writing it, no picker needed. The one real exception is an account
  // with no linked Author at all — e.g. a root superuser created via
  // `createsuperuser` rather than through Users — who'd otherwise have no
  // way to create an article at all. That case alone still needs a picker.
  const needsAuthorPicker = isNew && !user?.author_id;

  const { fieldError, fieldClass, touch, touchAll, isValid } = useFormValidation(form, {
    title: required('Title'),
    slug: slugRule('Slug'),
    body: requiredHtml('Body'),
    category_id: required('Category'),
    ...(needsAuthorPicker ? { author_id: required('Author') } : {}),
  });

  useEffect(() => {
    if (existing) {
      setForm({
        title: existing.title, slug: existing.slug, dek: existing.dek, body: existing.body,
        meta_title: existing.meta_title, meta_description: existing.meta_description,
        image_credit: existing.image_credit,
        category_id: existing.category.id, author_id: existing.author.id,
        co_author_ids: existing.co_authors.map((a) => a.id),
        tag_ids: existing.tags.map((t) => t.id),
        status: existing.status, published_at: existing.published_at,
        is_breaking: existing.is_breaking, is_exclusive: existing.is_exclusive, is_editors_pick: existing.is_editors_pick,
        is_reference: existing.is_reference, is_main: existing.is_main,
        is_indexed: existing.is_indexed, show_author_name: existing.show_author_name,
      });
      setTags(existing.tags);
      setCoAuthors(existing.co_authors);
      setImageAsset(existing.image ? { id: -1, url: existing.image } : null);
      setImageTouched(false);
      setSlugTouched(true);
      setFormReady(true);
    }
  }, [existing]);

  // Covers switching between two different existing articles without a
  // full remount (e.g. editing the `:id` in the URL directly) — resets the
  // gate above so the newly-fetched article's body isn't skipped either.
  useEffect(() => {
    setFormReady(isNew);
  }, [id, isNew]);

  // There's no author picker at all — a new article always belongs to
  // whoever's writing it, full stop, no reassigning it to someone else.
  useEffect(() => {
    if (isNew && user?.author_id && !form.author_id) {
      setForm((f) => ({ ...f, author_id: user.author_id! }));
    }
  }, [isNew, user, form.author_id]);

  function updateField<K extends keyof ArticleWritePayload>(key: K, value: ArticleWritePayload[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleTitleChange(title: string) {
    updateField('title', title);
    if (!slugTouched) updateField('slug', slugify(title));
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
      const payload = {
        ...form,
        tag_ids: tags.map((t) => t.id),
        co_author_ids: coAuthors.map((a) => a.id),
        ...(imageTouched ? { image_asset_id: imageAsset?.id ?? null } : {}),
      };
      if (articleId) {
        await updateArticle(articleId, payload);
        toast.success('Article saved.');
      } else {
        await createArticle(payload);
        toast.success('Article created.');
        navigate('/articles');
        return;
      }
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to save the article.'));
    } finally {
      setSaving(false);
    }
  }

  if (existingError) {
    return (
      <div>
        <h1 style={{ fontSize: 22, marginBottom: 20 }}>Edit Article</h1>
        <div className="card" style={{ borderColor: 'var(--error)', color: 'var(--error)' }}>
          Couldn't load this article — it may not exist, or you may not have permission to edit it
          (a Müəllif can only open articles credited to their own byline).
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22 }}>{isNew ? 'New Article' : 'Edit Article'}</h1>
        <button type="submit" className="btn btn-primary" disabled={saving || !formReady}>{saving ? 'Saving…' : 'Save'}</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Title</label>
          <input
            type="text"
            className={fieldClass('title')}
            value={form.title}
            onChange={(e) => handleTitleChange(e.target.value)}
            onBlur={() => touch('title')}
          />
          {fieldError('title') && <p className="field-error">{fieldError('title')}</p>}
        </div>
        <div className="field">
          <label>Slug</label>
          <input
            type="text"
            className={fieldClass('slug')}
            value={form.slug}
            onChange={(e) => { setSlugTouched(true); updateField('slug', e.target.value); }}
            onBlur={() => touch('slug')}
          />
          {fieldError('slug') && <p className="field-error">{fieldError('slug')}</p>}
        </div>
        <div className="field">
          <label>Deck (short description)</label>
          <textarea rows={2} value={form.dek} onChange={(e) => updateField('dek', e.target.value)} maxLength={300} />
        </div>
        <div className="field">
          <label>Body</label>
          {formReady ? (
            <CKEditorBody
              value={form.body}
              onChange={(html) => { updateField('body', html); touch('body'); }}
              resetKey={existing?.id ?? 'new'}
            />
          ) : (
            <div className="ckeditor-wrap" style={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              Loading…
            </div>
          )}
          {fieldError('body') && <p className="field-error">{fieldError('body')}</p>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Main Image</h2>
        <ImagePicker
          value={imageAsset}
          onChange={(next) => { setImageAsset(next); setImageTouched(true); }}
          aspect={16 / 9}
          recommendedSize={ARTICLE_IMAGE_SIZE}
        />
        <div className="field" style={{ marginTop: 12 }}>
          <label>Photo Credit (optional)</label>
          <input
            type="text"
            value={form.image_credit}
            onChange={(e) => updateField('image_credit', e.target.value)}
            placeholder='e.g. "Reuters" or "AI-generated image"'
          />
          <p className="field-hint">Shown as a small "Photo: …" caption directly under the main image — just the source/photographer, "Photo:" is added automatically. Leave blank to show nothing.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 20 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Category</label>
          <select
            className={fieldClass('category_id')}
            value={form.category_id}
            onChange={(e) => updateField('category_id', Number(e.target.value))}
            onBlur={() => touch('category_id')}
          >
            <option value={0} disabled>Select a category</option>
            {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {fieldError('category_id') && <p className="field-error">{fieldError('category_id')}</p>}
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Author</label>
          {needsAuthorPicker ? (
            <>
              <select
                className={fieldClass('author_id')}
                value={form.author_id}
                onChange={(e) => updateField('author_id', Number(e.target.value))}
                onBlur={() => touch('author_id')}
              >
                <option value={0} disabled>Select an author</option>
                {authors?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              {fieldError('author_id') && <p className="field-error">{fieldError('author_id')}</p>}
              <p className="field-hint">Your account has no journalist profile of its own, so pick who this is credited to.</p>
            </>
          ) : (
            <>
              <div style={{ height: 38, display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                {existing ? existing.author.name : (user?.author_name ?? '—')}
              </div>
              <p className="field-hint">Always whoever's writing it — not reassignable here.</p>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Co-authors</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {coAuthors.map((a) => (
              <span key={a.id} className="badge" style={{ background: 'var(--brand-wash)', color: 'var(--brand)' }}>
                {a.name}{' '}
                <button
                  type="button"
                  onClick={() => setCoAuthors((cs) => cs.filter((c) => c.id !== a.id))}
                  style={{ border: 0, background: 'none', cursor: 'pointer', color: 'var(--brand)' }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <select
            value={0}
            onChange={(e) => {
              const picked = authors?.find((a) => a.id === Number(e.target.value));
              if (picked) setCoAuthors((cs) => [...cs, picked]);
            }}
          >
            <option value={0} disabled>+ Add a co-author</option>
            {authors
              ?.filter((a) => a.id !== form.author_id && !coAuthors.some((c) => c.id === a.id))
              .map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <p className="field-hint">For jointly-reported pieces — each co-author is credited and linked in the byline alongside the primary author.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Tags</label>
          <TagPicker selected={tags} onChange={setTags} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 20 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Status</label>
          <select
            value={form.status}
            onChange={(e) => {
              const status = e.target.value as ArticleStatus;
              // The backend defaults this too if it's ever left blank, but
              // filling it in here makes the "when does this go live"
              // behavior visible instead of relying on invisible backend
              // magic — every public listing filters on published_at, so
              // a Published article with no date silently never appears.
              if (status === 'published' && !form.published_at) {
                setForm((f) => ({ ...f, status, published_at: new Date().toISOString() }));
              } else {
                updateField('status', status);
              }
            }}
          >
            <option value="draft">Draft</option>
            <option value="scheduled">Scheduled</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Publish Date/Time</label>
          <input
            type="datetime-local"
            value={form.published_at ? form.published_at.slice(0, 16) : ''}
            onChange={(e) => updateField('published_at', e.target.value ? new Date(e.target.value).toISOString() : null)}
          />
          <p className="field-hint">A future date + "Scheduled" status will hold it until then.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Flags</h2>
        {BOOLEAN_FIELDS.map(({ key, label, hint }) => (
          <div key={key}>
            <div className="checkbox-field">
              <input
                type="checkbox"
                id={key}
                checked={form[key] as boolean}
                onChange={(e) => updateField(key, e.target.checked as any)}
              />
              <label htmlFor={key}>{label}</label>
            </div>
            {hint && <p className="field-hint" style={{ marginTop: -8, marginBottom: 12 }}>{hint}</p>}
          </div>
        ))}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>SEO</h2>
        <div className="field">
          <label>SEO Title</label>
          <input type="text" value={form.meta_title} onChange={(e) => updateField('meta_title', e.target.value)} placeholder={form.title} maxLength={150} />
        </div>
        <div className="field">
          <label>Meta Description</label>
          <textarea rows={2} value={form.meta_description} onChange={(e) => updateField('meta_description', e.target.value)} placeholder={form.dek} maxLength={300} />
        </div>
      </div>
    </form>
  );
}
