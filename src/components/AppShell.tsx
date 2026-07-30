'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from '@/components/Sidebar';

export const AppShell = ({ children }: { children: React.ReactNode }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
