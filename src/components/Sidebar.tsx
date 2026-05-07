import React from 'react';
import { 
  Activity, 
  LayoutDashboard, 
  Users, 
  BarChart3, 
  FileText, 
  Settings,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SidebarItem = ({ 
  icon: Icon, 
  label, 
  active = false,
  badge 
}: { 
  icon: any, 
  label: string, 
  active?: boolean,
  badge?: string 
}) => (
  <div className={cn(
    "flex items-center justify-between px-4 py-3 cursor-pointer transition-all duration-200 group",
    active ? "bg-orange-500/10 border-r-4 border-orange-500" : "hover:bg-slate-800"
  )}>
    <div className="flex items-center gap-3">
      <Icon size={20} className={active ? "text-orange-500" : "text-slate-400 group-hover:text-white"} />
      <span className={cn(
        "text-sm font-medium",
        active ? "text-white" : "text-slate-400 group-hover:text-white"
      )}>
        {label}
      </span>
    </div>
    {badge && (
      <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded uppercase">
        {badge}
      </span>
    )}
  </div>
);

const SidebarSection = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div className="mt-8">
    <h3 className="px-4 text-[10px] font-bold text-orange-500/60 uppercase tracking-wider mb-2">
      {title}
    </h3>
    {children}
  </div>
);

export const Sidebar = ({ 
  isOpen, 
  onClose 
}: { 
  isOpen?: boolean, 
  onClose?: () => void 
}) => {
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}

      <div className={cn(
        "w-[280px] lg:w-64 bg-sidebar-bg h-screen fixed left-0 top-0 flex flex-col border-r border-slate-800 z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 shadow-2xl lg:shadow-none",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center text-white font-bold">
              K
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">KidneyGuard</h1>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Clinical AI · v2.1</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-white p-1"
          >
            <Plus className="rotate-45" size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <SidebarSection title="Main">
            <SidebarItem icon={Activity} label="Predict Risk" active />
            <SidebarItem icon={LayoutDashboard} label="Dashboard" />
            <SidebarItem icon={Users} label="Patient Records" />
            <SidebarItem icon={BarChart3} label="Analytics" />
          </SidebarSection>

          <SidebarSection title="Reports">
            <SidebarItem icon={FileText} label="Generate Reports" />
            <SidebarItem icon={Settings} label="Settings" />
          </SidebarSection>
        </div>
        
        <div className="p-4 mt-auto">
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
            <p className="text-xs text-slate-400 mb-2">Need help?</p>
            <button className="text-xs text-white bg-slate-700 hover:bg-slate-600 w-full py-2 rounded-lg transition-colors">
              Documentation
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
