import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { createUser, fetchUser, updateUser } from '../../api/users';
import { createAuthor, fetchAuthorList, updateAuthor } from '../../api/authors';
import { ImagePicker, type ImagePickerValue } from '../../components/ImagePicker';
import { AVATAR_SIZE } from '../../utils/imageSizes';
import type { AuthorWritePayload, UserRole, UserWritePayload } from '../../api/types';
import { slugify } from '../../utils/slugify';
import { useToast, errorMessage } from '../../components/toast/ToastContext';
import { useFormValidation, required, email as emailRule, url as urlRule } from '../../utils/validation';
import { ROLE_LABELS, ROLE_DESCRIPTIONS } from '../../utils/roles';

const ROLES: UserRole[] = ['Administrator', 'Baş Redaktor', 'Redaktor', 'Müəllif'];

const emptyProfile: Omit<AuthorWritePayload, 'user'> = {
  name: '', slug: '', title: '', bio: '', email: '', phone: '',
  facebook_url: '', twitter_url: '', instagram_url: '', linkedin_url: '',
  youtube_url: '', telegram_url: '', other_social_url: '',
  show_on_about: false, order: 0,
};

export function UserFormPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const toast = useToast();

  const { data: existingUser } = useQuery({
    queryKey: ['user', id], queryFn: () => fetchUser(Number(id)), enabled: !isNew,
  });
  // No "get author by user id" endpoint — the author list is small, so
  // fetch it all and match client-side (same approach UserListPage uses).
  const { data: authors } = useQuery({
    queryKey: ['authors-admin'], queryFn: fetchAuthorList, enabled: !isNew,
  });

  const [login, setLogin] = useState<UserWritePayload>({
    username: '', email: '', first_name: '', last_name: '', is_active: true, role: 'Müəllif', password: '',
  });
  const [profile, setProfile] = useState(emptyProfile);
  const [slugTouched, setSlugTouched] = useState(false);
  const [userId, setUserId] = useState<number | null>(isNew ? null : Number(id));
  const [authorId, setAuthorId] = useState<number | null>(null);
  const [avatarAsset, setAvatarAsset] = useState<ImagePickerValue | null>(null);
  const [avatarTouched, setAvatarTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const loginValidation = useFormValidation(login, {
    username: required('Username'),
    password: (value, values) => (isNew ? required('Password')(value, values) : null),
  });
  const profileValidation = useFormValidation(profile, {
    email: emailRule('Public Email'),
    facebook_url: urlRule('Facebook URL'),
    twitter_url: urlRule('X (Twitter) URL'),
    instagram_url: urlRule('Instagram URL'),
    linkedin_url: urlRule('LinkedIn URL'),
    youtube_url: urlRule('YouTube URL'),
    telegram_url: urlRule('Telegram URL'),
    other_social_url: urlRule('Other social URL'),
  });
  const isValid = loginValidation.isValid && profileValidation.isValid;
  function touchAll() {
    loginValidation.touchAll();
    profileValidation.touchAll();
  }

  useEffect(() => {
    if (existingUser) {
      setLogin({ ...existingUser, password: '' });
    }
  }, [existingUser]);

  useEffect(() => {
    if (existingUser && authors) {
      const author = authors.find((a) => a.user === existingUser.id);
      if (author) {
        setAuthorId(author.id);
        setProfile({ ...author });
        setAvatarAsset(author.avatar ? { id: -1, url: author.avatar } : null);
        setAvatarTouched(false);
        setSlugTouched(true);
      }
    }
  }, [existingUser, authors]);

  // Position isn't a separate manual field anymore — it always mirrors the
  // selected Role's display label, so this keeps it in sync whenever the
  // role changes (including on initial load from an existing user).
  useEffect(() => {
    setProfile((p) => ({ ...p, title: ROLE_LABELS[login.role] }));
  }, [login.role]);

  function handleNameChange(field: 'first_name' | 'last_name', value: string) {
    const nextLogin = { ...login, [field]: value };
    setLogin(nextLogin);
    const fullName = `${nextLogin.first_name} ${nextLogin.last_name}`.trim();
    setProfile((p) => ({ ...p, name: fullName, slug: slugTouched ? p.slug : slugify(fullName) }));
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
      // No separate "Login Email" field anymore — the account's email just
      // mirrors Public Email, so it isn't left blank without asking twice.
      const loginPayload = { ...login, email: profile.email };
      if (!isNew && !loginPayload.password) delete loginPayload.password;

      let uid = userId;
      if (uid) {
        await updateUser(uid, loginPayload);
      } else {
        const saved = await createUser(loginPayload);
        uid = saved.id;
        setUserId(uid);
      }

      const profilePayload = {
        ...profile,
        user: uid!,
        ...(avatarTouched ? { avatar_asset_id: avatarAsset?.id ?? null } : {}),
      };
      if (authorId) {
        await updateAuthor(authorId, profilePayload);
      } else {
        const savedAuthor = await createAuthor(profilePayload);
        setAuthorId(savedAuthor.id);
      }

      toast.success(isNew ? 'User created.' : 'User saved.');
      navigate(`/users/${uid}`, { replace: true });
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to save the user.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ maxWidth: 700 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22 }}>{isNew ? 'New User' : 'Edit User'}</h1>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>

      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 20 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Username</label>
          <input
            type="text"
            className={loginValidation.fieldClass('username')}
            value={login.username}
            onChange={(e) => setLogin((l) => ({ ...l, username: e.target.value }))}
            onBlur={() => loginValidation.touch('username')}
          />
          {loginValidation.fieldError('username') && <p className="field-error">{loginValidation.fieldError('username')}</p>}
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>{isNew ? 'Password' : 'New Password (leave blank to keep current)'}</label>
          <input
            type="password"
            className={loginValidation.fieldClass('password')}
            value={login.password}
            onChange={(e) => setLogin((l) => ({ ...l, password: e.target.value }))}
            onBlur={() => loginValidation.touch('password')}
          />
          {loginValidation.fieldError('password') && <p className="field-error">{loginValidation.fieldError('password')}</p>}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 20 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Role</label>
          <select value={login.role} onChange={(e) => setLogin((l) => ({ ...l, role: e.target.value as UserRole }))}>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <p className="field-hint">{ROLE_DESCRIPTIONS[login.role]}</p>
        </div>
        <div className="checkbox-field" style={{ alignSelf: 'center' }}>
          <input type="checkbox" id="is_active" checked={login.is_active} onChange={(e) => setLogin((l) => ({ ...l, is_active: e.target.checked }))} />
          <label htmlFor="is_active">Active</label>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 20 }}>
        <div className="field" style={{ flex: 1 }}>
          <label>First Name</label>
          <input type="text" value={login.first_name} onChange={(e) => handleNameChange('first_name', e.target.value)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>Last Name</label>
          <input type="text" value={login.last_name} onChange={(e) => handleNameChange('last_name', e.target.value)} />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Profile Slug (used in the /team/ URL)</label>
          <input type="text" value={profile.slug} onChange={(e) => { setSlugTouched(true); setProfile((p) => ({ ...p, slug: e.target.value })); }} />
        </div>
        <div className="field">
          <label>Bio</label>
          <textarea rows={4} value={profile.bio} onChange={(e) => setProfile((p) => ({ ...p, bio: e.target.value }))} />
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Public Email</label>
            <input
              type="email"
              className={profileValidation.fieldClass('email')}
              value={profile.email}
              onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
              onBlur={() => profileValidation.touch('email')}
            />
            {profileValidation.fieldError('email') && <p className="field-error">{profileValidation.fieldError('email')}</p>}
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Phone</label>
            <input type="text" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} />
          </div>
        </div>
        <div className="checkbox-field">
          <input type="checkbox" id="show_on_about" checked={profile.show_on_about} onChange={(e) => setProfile((p) => ({ ...p, show_on_about: e.target.checked }))} />
          <label htmlFor="show_on_about">Show on About page</label>
        </div>
        <p className="field-hint" style={{ marginTop: -8 }}>Gives this person a public card on the About page and their own /team/ profile URL.</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Avatar</h2>
        <ImagePicker
          value={avatarAsset}
          onChange={(next) => { setAvatarAsset(next); setAvatarTouched(true); }}
          aspect={1}
          recommendedSize={AVATAR_SIZE}
        />
      </div>

      <div className="card">
        <h2 style={{ fontSize: 15, marginBottom: 12 }}>Social Links</h2>
        <div style={{ display: 'flex', gap: 20 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Facebook</label>
            <input
              type="url"
              className={profileValidation.fieldClass('facebook_url')}
              value={profile.facebook_url}
              onChange={(e) => setProfile((p) => ({ ...p, facebook_url: e.target.value }))}
              onBlur={() => profileValidation.touch('facebook_url')}
            />
            {profileValidation.fieldError('facebook_url') && <p className="field-error">{profileValidation.fieldError('facebook_url')}</p>}
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>X (Twitter)</label>
            <input
              type="url"
              className={profileValidation.fieldClass('twitter_url')}
              value={profile.twitter_url}
              onChange={(e) => setProfile((p) => ({ ...p, twitter_url: e.target.value }))}
              onBlur={() => profileValidation.touch('twitter_url')}
            />
            {profileValidation.fieldError('twitter_url') && <p className="field-error">{profileValidation.fieldError('twitter_url')}</p>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>Instagram</label>
            <input
              type="url"
              className={profileValidation.fieldClass('instagram_url')}
              value={profile.instagram_url}
              onChange={(e) => setProfile((p) => ({ ...p, instagram_url: e.target.value }))}
              onBlur={() => profileValidation.touch('instagram_url')}
            />
            {profileValidation.fieldError('instagram_url') && <p className="field-error">{profileValidation.fieldError('instagram_url')}</p>}
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>LinkedIn</label>
            <input
              type="url"
              className={profileValidation.fieldClass('linkedin_url')}
              value={profile.linkedin_url}
              onChange={(e) => setProfile((p) => ({ ...p, linkedin_url: e.target.value }))}
              onBlur={() => profileValidation.touch('linkedin_url')}
            />
            {profileValidation.fieldError('linkedin_url') && <p className="field-error">{profileValidation.fieldError('linkedin_url')}</p>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>YouTube</label>
            <input
              type="url"
              className={profileValidation.fieldClass('youtube_url')}
              value={profile.youtube_url}
              onChange={(e) => setProfile((p) => ({ ...p, youtube_url: e.target.value }))}
              onBlur={() => profileValidation.touch('youtube_url')}
            />
            {profileValidation.fieldError('youtube_url') && <p className="field-error">{profileValidation.fieldError('youtube_url')}</p>}
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Telegram</label>
            <input
              type="url"
              className={profileValidation.fieldClass('telegram_url')}
              value={profile.telegram_url}
              onChange={(e) => setProfile((p) => ({ ...p, telegram_url: e.target.value }))}
              onBlur={() => profileValidation.touch('telegram_url')}
            />
            {profileValidation.fieldError('telegram_url') && <p className="field-error">{profileValidation.fieldError('telegram_url')}</p>}
          </div>
        </div>
        <div className="field">
          <label>Other</label>
          <input
            type="url"
            className={profileValidation.fieldClass('other_social_url')}
            value={profile.other_social_url}
            onChange={(e) => setProfile((p) => ({ ...p, other_social_url: e.target.value }))}
            onBlur={() => profileValidation.touch('other_social_url')}
          />
          {profileValidation.fieldError('other_social_url') && <p className="field-error">{profileValidation.fieldError('other_social_url')}</p>}
        </div>
      </div>
    </form>
  );
}
