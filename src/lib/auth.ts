export const SESSION_COOKIE = "ga_session";

export function makeSessionToken(secret: string): string {
  return btoa(`${secret}:v1`);
}

function getExpectedToken(): string {
  const secret = process.env.NEXT_PUBLIC_AUTH_SECRET ?? "gsa-aniya-2026-x9k";
  return makeSessionToken(secret);
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SESSION_COOKIE) === getExpectedToken();
}

export function clientLogin(email: string, password: string): { success: boolean; error?: string } {
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;
  const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return { success: false, error: "Server configuration error. Contact administrator." };
  }
  if (email.trim() !== adminEmail || password !== adminPassword) {
    return { success: false, error: "Invalid email or password." };
  }

  localStorage.setItem(SESSION_COOKIE, getExpectedToken());
  return { success: true };
}

export function clientLogout(): void {
  localStorage.removeItem(SESSION_COOKIE);
}
