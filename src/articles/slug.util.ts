import { randomBytes } from 'crypto';
import { FALLBACK_SLUG_BASE, SLUG_SUFFIX_BYTES } from './article.constants';

const COMBINING_DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

export function slugify(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(COMBINING_DIACRITICS, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || FALLBACK_SLUG_BASE;
}

export function generateArticleSlug(title: string): string {
  const suffix = randomBytes(SLUG_SUFFIX_BYTES).toString('hex');
  return `${slugify(title)}-${suffix}`;
}
