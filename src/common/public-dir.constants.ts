import { join } from 'path';

/** Absolute path to the `public/` folder served by ServeStaticModule. */
export const PUBLIC_DIR = join(__dirname, '..', '..', 'public');

export const UPLOADS_DIR = join(PUBLIC_DIR, 'uploads');

export const AVATAR_UPLOADS_DIR = join(UPLOADS_DIR, 'avatars');
