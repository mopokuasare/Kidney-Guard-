'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  LayoutDashboard,
  Users,
  BarChart3,
  FileText,
  Settings,
  Plus,
  LogOut,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT, LANGUAGES, type Lang } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';

const SidebarItem = ({
  icon: Icon,
  label,
  href,
  active = false,
  badge,
  onNavigate,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  href: string;
  active?: boolean;
  badge?: string;
  onNavigate?: () => void;
}) => (
  <Link
    href={href}
    onClick={onNavigate}
    className={cn(
      'flex items-center justify-between px-4 py-3 cursor-pointer transition-all duration-200 group',
      active ? 'bg-orange-500/10 border-r-4 border-orange-500' : 'hover:bg-slate-800'
    )}
  >
    <div className="flex items-center gap-3">
      <Icon size={20} className={active ? 'text-orange-500' : 'text-slate-400 group-hover:text-white'} />
      <span className={cn('text-sm font-medium', active ? 'text-white' : 'text-slate-400 group-hover:text-white')}>
        {label}
      </span>
    </div>
    {badge && (
      <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded uppercase">{badge}</span>
    )}
  </Link>
);

const SidebarSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mt-8">
    <h3 className="px-4 text-[10px] font-bold text-orange-500/60 uppercase tracking-wider mb-2">{title}</h3>
    {children}
  </div>
);

const MAIN_LINKS = [
  { icon: Activity, key: 'nav.predict', href: '/' },
  { icon: LayoutDashboard, key: 'nav.dashboard', href: '/dashboard' },
  { icon: Users, key: 'nav.patients', href: '/patients' },
  { icon: BarChart3, key: 'nav.analytics', href: '/analytics' },
];

const REPORT_LINKS = [
  { icon: FileText, key: 'nav.generateReports', href: '/reports' },
  { icon: Settings, key: 'nav.settings', href: '/settings' },
];

export const Sidebar = ({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) => {
  const pathname = usePathname();
  const { t, lang, setLang } = useT();
  const { user, profile, role, signOut, configured, loading } = useAuth();

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity" onClick={onClose} />
      )}

      <div
        className={cn(
          'w-[280px] lg:w-64 bg-sidebar-bg h-screen fixed left-0 top-0 flex flex-col border-r border-slate-800 z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 shadow-2xl lg:shadow-none',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="p-6 flex items-center justify-between">
          <Link href="/" onClick={onClose} className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center text-white font-bold">K</div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">KidneyGuard</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{t('app.tagline')}</p>
            </div>
          </Link>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white p-1">
            <Plus className="rotate-45" size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <SidebarSection title={t('nav.main')}>
            {MAIN_LINKS.map((link) => (
              <SidebarItem
                key={link.href}
                icon={link.icon}
                label={t(link.key)}
                href={link.href}
                active={isActive(link.href)}
                onNavigate={onClose}
              />
            ))}
          </SidebarSection>

          <SidebarSection title={t('nav.reports')}>
            {REPORT_LINKS.map((link) => (
              <SidebarItem
                key={link.href}
                icon={link.icon}
                label={t(link.key)}
                href={link.href}
                active={isActive(link.href)}
                onNavigate={onClose}
              />
            ))}
          </SidebarSection>
        </div>

        <div className="p-4 mt-auto space-y-3">
          {/* Language switcher */}
          <div className="flex items-center gap-2 bg-slate-800/50 rounded-xl px-3 py-2 border border-slate-700">
            <Globe size={16} className="text-slate-400 shrink-0" />
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as Lang)}
              aria-label={t('nav.language')}
              className="bg-transparent text-xs text-slate-200 w-full focus:outline-none cursor-pointer"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="bg-slate-800 text-slate-200">
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          {/* User / auth block */}
          {configured && user ? (
            <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold text-sm shrink-0">
                  {(profile?.full_name || user.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{profile?.full_name || user.email}</p>
                  {role && <p className="text-[10px] text-orange-400/80 uppercase tracking-wider font-bold">{t(`auth.role.${role}`)}</p>}
                </div>
              </div>
              <button
                onClick={signOut}
                className="w-full flex items-center justify-center gap-2 text-xs text-slate-300 bg-slate-700 hover:bg-slate-600 py-2 rounded-lg transition-colors"
              >
                <LogOut size={14} />
                {t('nav.signOut')}
              </button>
            </div>
          ) : configured && loading ? (
            /* Auth still resolving — render a placeholder rather than a
               "Sign in" link, which would otherwise flash at (or stick for)
               a clinician who is already signed in. */
            <div className="h-9 rounded-lg bg-slate-800/60 animate-pulse" />
          ) : configured ? (
            <Link
              href="/login"
              onClick={onClose}
              className="block text-center text-xs text-white bg-slate-700 hover:bg-slate-600 w-full py-2 rounded-lg transition-colors"
            >
              {t('auth.signIn')}
            </Link>
          ) : null}
        </div>
      </div>
    </>
  );
};
