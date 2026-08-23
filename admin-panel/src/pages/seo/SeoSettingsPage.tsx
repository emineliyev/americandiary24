import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchSiteSettings, updateSiteSettings } from '../../api/siteSettings';
import { ImagePicker, type ImagePickerValue } from '../../components/ImagePicker';
import { SHARE_IMAGE_SIZE } from '../../utils/imageSizes';
import { useToast, errorMessage } from '../../components/toast/ToastContext';

export function SeoSettingsPage() {
  const toast = useToast();
  // Same query key as SiteSettingsPage — both views edit slices of the same
  // singleton row, so they should share (and invalidate) one cache entry.
  const { data: existing } = useQuery({ queryKey: ['site-settings'], queryFn: fetchSiteSettings });

  const [metaDescription, setMetaDescription] = useState('');
  const [googleVerification, setGoogleVerification] = useState('');
  const [shareImage, setShareImage] = useState<ImagePickerValue | null>(null);
  const [shareImageTouched, setShareImageTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  // Same race as SiteSettingsPage's own `loaded` guard — don't render the
  // form (and its state) until the initial GET has actually landed.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (existing) {
      setMetaDescription(existing.default_meta_description);
      setGoogleVerification(existing.google_site_verification);
      setShareImage(existing.default_share_image ? { id: -1, url: existing.default_share_image } : null);
      setShareImageTouched(false);
      setLoaded(true);
    }
  }, [existing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSiteSettings({
        default_meta_description: metaDescription,
        google_site_verification: googleVerification,
        ...(shareImageTouched ? { default_share_image_asset_id: shareImage?.id ?? null } : {}),
      });
      toast.success('SEO settings saved.');
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to save SEO settings.'));
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
        <h1 style={{ fontSize: 22 }}>SEO</h1>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Default Meta Description</h2>
        <p className="field-hint" style={{ marginBottom: 12 }}>
          Used on the homepage and any page that doesn't set its own description (articles and static
          Pages already have their own SEO fields). Also doubles as the default social-share text.
        </p>
        <div className="field">
          <textarea
            rows={3}
            maxLength={300}
            placeholder="Breaking news, politics, business and world coverage from The American Diary 24."
            value={metaDescription}
            onChange={(e) => setMetaDescription(e.target.value)}
          />
          <p className="field-hint">{metaDescription.length}/300</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Default Social Share Image</h2>
        <p className="field-hint" style={{ marginBottom: 12 }}>
          Shown as the preview image when the homepage or another image-less page is shared on
          Facebook/X. Articles keep using their own main image instead when they have one.
        </p>
        <ImagePicker
          value={shareImage}
          onChange={(next) => { setShareImage(next); setShareImageTouched(true); }}
          aspect={SHARE_IMAGE_SIZE.width / SHARE_IMAGE_SIZE.height}
          recommendedSize={SHARE_IMAGE_SIZE}
        />
      </div>

      <div className="card">
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Google Search Console</h2>
        <div className="field">
          <label>Verification code</label>
          <input
            type="text"
            placeholder="e.g. abcXYZ123..."
            value={googleVerification}
            onChange={(e) => setGoogleVerification(e.target.value)}
          />
          <p className="field-hint">
            From Search Console's HTML tag verification method — paste just the <code>content</code> value,
            not the full tag. Leave blank if you haven't set up Search Console.
          </p>
        </div>
      </div>
    </form>
  );
}
