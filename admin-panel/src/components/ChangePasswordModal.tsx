import { useState } from 'react';
import { changePassword } from '../api/auth';
import { useToast, errorMessage } from './toast/ToastContext';
import { useFormValidation, required, minLength, all } from '../utils/validation';
import './ChangePasswordModal.css';

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [saving, setSaving] = useState(false);

  const { fieldError, fieldClass, touch, touchAll, isValid } = useFormValidation(form, {
    current_password: required('Current password'),
    new_password: all(required('New password'), minLength('New password', 8)),
    confirm_password: (value, values) => {
      if (!value) return 'Please confirm the new password.';
      return value !== values.new_password ? 'Passwords do not match.' : null;
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    touchAll();
    if (!isValid) {
      toast.error('Please fix the highlighted fields.');
      return;
    }
    setSaving(true);
    try {
      await changePassword(form.current_password, form.new_password);
      toast.success('Password changed.');
      onClose();
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to change the password.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="password-overlay" onClick={onClose}>
      <div className="password-dialog" onClick={(e) => e.stopPropagation()}>
        <h2>Change Password</h2>
        <form onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label>Current Password</label>
            <input
              type="password"
              autoFocus
              className={fieldClass('current_password')}
              value={form.current_password}
              onChange={(e) => setForm((f) => ({ ...f, current_password: e.target.value }))}
              onBlur={() => touch('current_password')}
            />
            {fieldError('current_password') && <p className="field-error">{fieldError('current_password')}</p>}
          </div>
          <div className="field">
            <label>New Password</label>
            <input
              type="password"
              className={fieldClass('new_password')}
              value={form.new_password}
              onChange={(e) => setForm((f) => ({ ...f, new_password: e.target.value }))}
              onBlur={() => touch('new_password')}
            />
            {fieldError('new_password') && <p className="field-error">{fieldError('new_password')}</p>}
            <p className="field-hint">At least 8 characters, not too common or all-numeric.</p>
          </div>
          <div className="field">
            <label>Confirm New Password</label>
            <input
              type="password"
              className={fieldClass('confirm_password')}
              value={form.confirm_password}
              onChange={(e) => setForm((f) => ({ ...f, confirm_password: e.target.value }))}
              onBlur={() => touch('confirm_password')}
            />
            {fieldError('confirm_password') && <p className="field-error">{fieldError('confirm_password')}</p>}
          </div>
          <div className="password-dialog__actions">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Change Password'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
