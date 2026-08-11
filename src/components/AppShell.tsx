'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, Loader2 } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';
import { useAuth } from '@/lib/auth';

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { signedIn, loading, configured } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  /**
   * Client-side route guard.
   *
   * The session is held in localStorage so it survives browsers that refuse
   * cookies, which means the server cannot see it and the middleware cannot do
   * this check. Wait for auth to resolve before deciding, otherwise a signed-in
   * clinician would be redirected during the first render.
   */
  useEffect(() => {
    if (!configured || loading || signedIn) return;
    const redirect = pathname && pathname !== '/' ? `?redirect=${encodeURIComponent(pathname)}` : '';
    router.replace(`/login${redirect}`);
  }, [configured, loading, signedIn, pathname, router]);

  // Hold the shell back until auth is known, so protected content never flashes.
  if (configured && (loading || !signedIn)) {
    return (
      <div className="min-h-screen bg-main-bg flex items-center justify-center">
        <Loader2 size={22} className="animate-spin text-slate-300" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-main-bg flex">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <main className="flex-1 lg:ml-64 p-3 md:p-8 transition-all">
        {/* Mobile Nav Header */}
        <div className="lg:hidden flex items-center gap-4 mb-4 bg-white p-3 -m-3 border-b border-slate-200 sticky top-0 z-30">
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-50 rounded-lg"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-orange-500 rounded flex items-center justify-center text-white font-bold text-xs">
              K
            </div>
            <span className="font-bold text-slate-900 text-sm">KidneyGuard</span>
          </div>
        </div>

        {children}

        <div className="h-12" />
      </main>
    </div>
  );
};
