import { ExtractJwt } from 'passport-jwt';

export const JWT_AUTH_SCHEME = 'Token';
export const extractJwtFromAuthHeader =
  ExtractJwt.fromAuthHeaderWithScheme(JWT_AUTH_SCHEME);
