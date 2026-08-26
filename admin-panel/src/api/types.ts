export interface Page {
  id: number;
  title: string;
  slug: string;
  body: string;
  meta_title: string;
  meta_description: string;
  is_active: boolean;
  updated_at: string;
}

export interface PageWritePayload {
  title: string;
  body: string;
  meta_title: string;
  meta_description: string;
  is_active: boolean;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface SiteSettings {
  contact_email: string;
  contact_whatsapp: string;
  contact_address: string;
  facebook_url: string;
  twitter_url: string;
  instagram_url: string;
  youtube_url: string;
  ga_measurement_id: string;
  adsense_publisher_id: string;
  ads_txt_content: string;
  default_meta_description: string;
  google_site_verification: string;
  default_share_image: string;
  // Write-only — not present on the GET response, only ever sent on PATCH.
  // See ImagePicker's image_asset_id convention (ArticleSerializer etc).
  default_share_image_asset_id?: number | null;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  order: number;
  is_active: boolean;
  show_on_homepage: boolean;
  homepage_order: number;
  homepage_new_row: boolean;
  homepage_title: string;
}

export interface Author {
  id: number;
  name: string;
  slug: string;
  avatar: string | null;
  user: number | null;
  title: string;
  bio: string;
  email: string;
  phone: string;
  facebook_url: string;
  twitter_url: string;
  instagram_url: string;
  linkedin_url: string;
  youtube_url: string;
  telegram_url: string;
  other_social_url: string;
  show_on_about: boolean;
  order: number;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
}

export interface CategoryWritePayload {
  name: string;
  slug: string;
  order: number;
  is_active: boolean;
  show_on_homepage: boolean;
  homepage_order: number;
  homepage_new_row: boolean;
  homepage_title: string;
}

export interface AuthorWritePayload {
  name: string;
  slug: string;
  user?: number;
  // Optional: omit entirely to leave the current avatar untouched (e.g. an
  // existing profile whose avatar wasn't changed in this edit) — present
  // with a value (or null) only when the picker was actually used.
  avatar_asset_id?: number | null;
  title: string;
  bio: string;
  email: string;
  phone: string;
  facebook_url: string;
  twitter_url: string;
  instagram_url: string;
  linkedin_url: string;
  youtube_url: string;
  telegram_url: string;
  other_social_url: string;
  show_on_about: boolean;
  order: number;
}

export type UserRole = 'Administrator' | 'Baş Redaktor' | 'Redaktor' | 'Müəllif';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  role: UserRole;
  date_joined: string;
}

export interface UserWritePayload {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  role: UserRole;
  password?: string;
}

export interface TagWritePayload {
  name: string;
  slug: string;
}

export type ArticleStatus = 'draft' | 'scheduled' | 'published' | 'archived';

export interface ArticleListItem {
  id: number;
  title: string;
  slug: string;
  category: Category;
  author: Author;
  status: ArticleStatus;
  published_at: string | null;
  updated_at: string;
  view_count: number;
  image: string | null;
  deleted_at: string | null;
  is_breaking: boolean;
  is_exclusive: boolean;
  is_editors_pick: boolean;
  is_reference: boolean;
  is_main: boolean;
}

export interface Article extends ArticleListItem {
  dek: string;
  body: string;
  meta_title: string;
  meta_description: string;
  image_credit: string;
  co_authors: Author[];
  tags: Tag[];
  is_indexed: boolean;
  show_author_name: boolean;
}

export interface ArticleWritePayload {
  title: string;
  slug: string;
  dek: string;
  body: string;
  meta_title: string;
  meta_description: string;
  // Optional: omit entirely to leave the current main image untouched —
  // present with a value (or null) only when the picker was actually used.
  image_asset_id?: number | null;
  image_credit: string;
  category_id: number;
  author_id: number;
  co_author_ids: number[];
  tag_ids: number[];
  status: ArticleStatus;
  published_at: string | null;
  is_breaking: boolean;
  is_exclusive: boolean;
  is_editors_pick: boolean;
  is_reference: boolean;
  is_main: boolean;
  is_indexed: boolean;
  show_author_name: boolean;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type MediaFormat = 'jpeg' | 'png' | 'webp' | 'svg';

export interface MediaFolder {
  id: number;
  name: string;
  order: number;
  asset_count: number;
}

export interface MediaAsset {
  id: number;
  file: string;
  original_filename: string;
  folder: number | null;
  format: MediaFormat;
  width: number | null;
  height: number | null;
  size_bytes: number;
  uploaded_by: number | null;
  created_at: string;
}

export interface DashboardStats {
  total: number;
  published: number;
  published_today: number;
  drafts: number;
  scheduled: number;
  categories_count: number;
  users_count: number;
  weekly: { date: string; count: number }[];
  by_category: { name: string; count: number; percent: number }[];
  most_read: ArticleListItem[];
  latest: ArticleListItem[];
}
