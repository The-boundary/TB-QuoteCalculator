import { type ReactNode } from 'react';
import { MissionControlAppShell } from '@the-boundary/design-system';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/uiStore';
import { Sidebar } from './Sidebar';

export function AppShell({ children }: { children: ReactNode }) {
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const wideMode = useUIStore((state) => state.wideMode);
  return (
    <MissionControlAppShell
      sidebar={<Sidebar />}
      collapsed={sidebarCollapsed}
      contentClassName={cn('mx-auto w-full p-4 sm:p-6 lg:p-8', wideMode ? 'max-w-full' : 'max-w-7xl')}
    >
      {children}
    </MissionControlAppShell>
  );
}
