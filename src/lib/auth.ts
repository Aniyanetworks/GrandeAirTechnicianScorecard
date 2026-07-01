export const SESSION_COOKIE = "ga_session";

export function makeSessionToken(secret: string): string {
  return btoa(`${secret}:v1`);
}
