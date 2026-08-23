import type { UserRole } from '../api/types';

// English display labels for the admin panel UI — the underlying values
// (sent to the API, matched against Django Group names for permissions
// everywhere else in the backend) stay the existing Azerbaijani strings.
// This is a display-only translation, not a rename of the role system.
export const ROLE_LABELS: Record<UserRole, string> = {
  'Administrator': 'Administrator',
  'Baş Redaktor': 'Editor-in-Chief',
  'Redaktor': 'Editor',
  'Müəllif': 'Author',
};

// Plain-language summary of what each role can actually do, sourced
// directly from the permission classes that enforce it server-side
// (news/api_views.py's IsOwnArticleOrEditorRole/IsTaxonomyManagerOrReadOnly/
// IsMediaManager, api/permissions.py's IsAdministratorOnly) — shown in the
// Users form so picking a role isn't a guess.
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  'Administrator': 'Full access: manages user accounts and journalist profiles, every article (including delete, permanently delete, and restore), categories, tags, and the media library.',
  'Baş Redaktor': 'Same as Administrator for content — every article (including delete/restore), categories, tags, and the media library — except cannot manage user accounts.',
  'Redaktor': 'Can create, edit, and publish any article, but cannot delete one. Categories, tags, and media folders are view-only.',
  'Müəllif': 'Can only create and edit their own articles — cannot touch anyone else\'s, and cannot delete even their own. Categories, tags, and media folders are view-only.',
};

// Mirrors IsTaxonomyManagerOrReadOnly.MANAGER_GROUPS on the backend — the
// API is the real gate, this only controls whether the UI bothers showing
// New/Edit/Delete controls a Redaktor or Müəllif can't actually use.
export function canManageTaxonomy(role?: string) {
  return role === 'Administrator' || role === 'Baş Redaktor';
}

// Mirrors IsOwnArticleOrEditorRole.DELETE_GROUPS — Redaktor can create/
// edit/publish articles but not hard-delete them.
export function canDeleteArticle(role?: string) {
  return role === 'Administrator' || role === 'Baş Redaktor';
}
