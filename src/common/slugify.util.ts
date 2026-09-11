const COMBINING_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

export function slugify(text: string, fallback = ''): string {
  const slug = text
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}
