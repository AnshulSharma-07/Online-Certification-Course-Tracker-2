// Central place for environment validation. Fails fast with a clear message.
const isProd = process.env.NODE_ENV === 'production';

export function validateEnv() {
  const missing = ['MONGODB_URI', 'JWT_SECRET'].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  if (isProd && process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production');
  }
  if (isProd && !process.env.CLIENT_URL) throw new Error('CLIENT_URL is required in production');
}

export const cloudinaryEnabled = () =>
  Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

// 'lax' works when client and API share a site (same domain / localhost).
// Use COOKIE_SAMESITE=none (requires HTTPS) when they are deployed on different sites.
export function cookieOptions() {
  const sameSite = (process.env.COOKIE_SAMESITE || 'lax').toLowerCase();
  return {
    httpOnly: true,
    secure: isProd || sameSite === 'none',
    sameSite,
    maxAge: 24 * 60 * 60 * 1000,
  };
}
