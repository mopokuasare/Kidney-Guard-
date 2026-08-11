import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KidneyGuard | Clinical AI",
  description: "Early Kidney Disease Risk Assessment powered by AI",
};

/**
 * The session lives in localStorage so it survives browsers that refuse
 * cookies, which means the server cannot read it. Auth state is therefore
 * resolved entirely on the client (AuthProvider) and routes are guarded in
 * AppShell.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} min-h-full flex flex-col antialiased`}>
        <LanguageProvider>
          <AuthProvider>{children}</AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
