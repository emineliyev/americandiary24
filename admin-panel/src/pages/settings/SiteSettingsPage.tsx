import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSiteSettings, updateSiteSettings } from '../../api/siteSettings';
import type { SiteSettings } from '../../api/types';
import { useToast, errorMessage } from '../../components/toast/ToastContext';
import { useFormValidation, email, url } from '../../utils/validation';

const EMPTY: SiteSettings = {
  contact_email: '', contact_whatsapp: '', contact_address: '',
  facebook_url: '', twitter_url: '', instagram_url: '', youtube_url: '',
  ga_measurement_id: '', adsense_publisher_id: '', ads_txt_content: '',
  default_meta_description: '', google_site_verification: '', default_share_image: '',
};

export function SiteSettingsPage() {
  const toast = useToast();
  const { data: existing } = useQuery({ queryKey: ['site-settings'], queryFn: fetchSiteSettings });

  const [form, setForm] = useState<SiteSettings>(EMPTY);
  const [saving, setSaving] = useState(false);
  // Same race as ArticleFormPage's CKEditor formReady guard: without this,
  // typing into a field before the initial GET resolves gets silently
  // clobbered when the fetched data lands and this effect copies it over
  // whatever the admin had already typed.
  const [loaded, setLoaded] = useState(false);

  const { fieldError, fieldClass, touch, touchAll, isValid } = useFormValidation(form, {
    contact_email: email('Contact email'),
    facebook_url: url('Facebook URL'),
    twitter_url: url('X URL'),
    instagram_url: url('Instagram URL'),
    youtube_url: url('YouTube URL'),
  });

  useEffect(() => {
    if (existing) {
      setForm(existing);
      setLoaded(true);
    }
  }, [existing]);

  function updateField<K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) {
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
      const saved = await updateSiteSettings(form);
      setForm(saved);
      toast.success('Site settings saved.');
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to save site settings.'));
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return <p>Loading…</p>;
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22 }}>Site Settings</h1>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Contact Info</h2>
        <p className="field-hint" style={{ marginBottom: 12 }}>Shown on the public Contact page.</p>
        <div className="field">
          <label>Email</label>
          <input
            type="text"
            className={fieldClass('contact_email')}
            value={form.contact_email}
            onChange={(e) => updateField('contact_email', e.target.value)}
            onBlur={() => touch('contact_email')}
          />
          {fieldError('contact_email') && <p className="field-error">{fieldError('contact_email')}</p>}
        </div>
        <div className="field">
          <label>Phone / WhatsApp</label>
          <input type="text" value={form.contact_whatsapp} onChange={(e) => updateField('contact_whatsapp', e.target.value)} />
        </div>
        <div className="field">
          <label>Address</label>
          <input type="text" value={form.contact_address} onChange={(e) => updateField('contact_address', e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Social Links</h2>
        <p className="field-hint" style={{ marginBottom: 12 }}>Leave blank to hide that icon from the public "Follow" widget — nothing links to a placeholder profile.</p>
        {(['facebook_url', 'twitter_url', 'instagram_url', 'youtube_url'] as const).map((field) => (
          <div className="field" key={field}>
            <label>{field === 'twitter_url' ? 'X (Twitter) URL' : field.replace('_url', '').replace(/^\w/, (c) => c.toUpperCase()) + ' URL'}</label>
            <input
              type="text"
              className={fieldClass(field)}
              placeholder="https://..."
              value={form[field]}
              onChange={(e) => updateField(field, e.target.value)}
              onBlur={() => touch(field)}
            />
            {fieldError(field) && <p className="field-error">{fieldError(field)}</p>}
          </div>
        ))}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Analytics &amp; Ads</h2>
        <div className="field">
          <label>Google Analytics Measurement ID</label>
          <input type="text" placeholder="G-XXXXXXXXXX" value={form.ga_measurement_id} onChange={(e) => updateField('ga_measurement_id', e.target.value)} />
          <p className="field-hint">Leave blank to disable Analytics entirely.</p>
        </div>
        <div className="field">
          <label>Google AdSense Publisher ID</label>
          <input type="text" placeholder="pub-1234567890123456" value={form.adsense_publisher_id} onChange={(e) => updateField('adsense_publisher_id', e.target.value)} />
          <p className="field-hint">Enables the site-wide AdSense auto-ads script and generates ads.txt automatically.</p>
        </div>
        <div className="field">
          <label>ads.txt override</label>
          <textarea rows={3} value={form.ads_txt_content} onChange={(e) => updateField('ads_txt_content', e.target.value)} />
          <p className="field-hint">Leave blank to auto-generate from the Publisher ID above. Only fill this in if Google gives you different/additional lines.</p>
        </div>
      </div>
    </form>
  );
}
