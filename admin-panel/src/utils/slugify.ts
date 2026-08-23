// Azerbaijani letters have no ASCII equivalent, so the old per-page
// slugify() (title.toLowerCase().replace(/[^a-z0-9]+/g, '-')) silently
// dropped them instead of transliterating — "Əli Həsənov" became "li-h-s-nov".
// İ needs its own entry: JS's locale-independent toLowerCase() turns it into
// "i̇" (i + a combining dot, U+0307), not plain "i".
const AZ_TRANSLIT: Record<string, string> = {
  'ə': 'e', 'Ə': 'e',
  'ç': 'c', 'Ç': 'c',
  'ğ': 'g', 'Ğ': 'g',
  'ı': 'i', 'İ': 'i',
  'ö': 'o', 'Ö': 'o',
  'ş': 's', 'Ş': 's',
  'ü': 'u', 'Ü': 'u',
};

export function slugify(value: string) {
  const transliterated = value.replace(/[əƏçÇğĞıİöÖşŞüÜ]/g, (ch) => AZ_TRANSLIT[ch]);
  return transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
