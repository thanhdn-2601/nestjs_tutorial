import { randomBytes } from 'crypto';
import { slugify } from '../common/slugify.util';
import { FALLBACK_SLUG_BASE, SLUG_SUFFIX_BYTES } from './article.constants';

export function generateArticleSlug(title: string): string {
  const suffix = randomBytes(SLUG_SUFFIX_BYTES).toString('hex');
  return `${slugify(title, FALLBACK_SLUG_BASE)}-${suffix}`;
}
