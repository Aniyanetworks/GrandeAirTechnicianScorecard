"use server";

import { cookies } from "next/headers";
import { SESSION_COOKIE, makeSessionToken } from "@/lib/auth";

export async function loginAction(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const secret = process.env.AUTH_SECRET ?? "gsa-aniya-2026-x9k";

  if (!adminEmail || !adminPassword) {
    return { success: false, error: "Server configuration error. Contact administrator." };
  }

  if (email.trim() !== adminEmail || password !== adminPassword) {
    return { success: false, error: "Invalid email or password." };
  }

  cookies().set(SESSION_COOKIE, makeSessionToken(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return { success: true };
}

export async function logoutAction(): Promise<void> {
  cookies().delete(SESSION_COOKIE);
}
