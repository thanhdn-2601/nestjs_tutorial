export interface JwtPayload {
  sub: number;
  email: string;
  /** Absent on tokens issued before the logout/blacklist feature. */
  jti?: string;
  exp?: number;
}
