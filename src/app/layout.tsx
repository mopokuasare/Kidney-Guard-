import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import { AuthProvider, type Profile } from "@/lib/auth";
import { getSupabaseServer } from "@/lib/supabase/server";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KidneyGuard | Clinical AI",
  description: "Early Kidney Disease Risk Assessment powered by AI",
};

/**
 * The layout resolves the signed-in clinician from the request cookies, so it
 * must render per request. Without this the shell could be prerendered at build
 * time - when there is no session - and every clinician would be served a
 * cached "signed out" sidebar.
 */
export const dynamic = "force-dynamic";

/**
 * Resolve the signed-in clinician on the server.
 *
 * The middleware already validates the session cookie on every request, so the
 * server is the authoritative source. Reading it here and seeding the client
 * provider removes a whole class of client/server mismatch — previously the
 * browser client could fail to see a session the server could, and the sidebar
 * rendered "Sign in" to someone who was already signed in.
 */
async function getInitialAuth(): Promise<{ email: string | null; profile: Profile | null }> {
  const supabase = await getSupabaseServer();
  if (!supabase) return { email: null, profile: null };

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Verification is a network call; a failure here must not render the
    // shell as signed-out for a clinician who is signed in.
    return { email: null, profile: null };
  }
  if (!user) return { email: null, profile: null };

  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .single();

  return {
    email: user.email ?? null,
    profile: (data as Profile) ?? { id: user.id, full_name: null, role: "doctor" },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { email, profile } = await getInitialAuth();

  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-full flex flex-col antialiased`}>
        <LanguageProvider>
          <AuthProvider initialEmail={email} initialProfile={profile}>
            {children}
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
