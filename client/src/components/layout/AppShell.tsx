import { type ReactNode, useMemo } from 'react';
import { MissionControlAppShell } from '@the-boundary/design-system';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/uiStore';
import { Sidebar } from './Sidebar';

interface AppShellProps { children: ReactNode; }

export function AppShell({ children }: AppShellProps) {
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const wideMode = useUIStore((state) => state.wideMode);
  const contentClassName = useMemo(
    () => cn('mx-auto w-full p-4 sm:p-6 lg:p-8', wideMode ? 'max-w-full' : 'max-w-7xl'),
    [wideMode],
  );
  return (
    <MissionControlAppShell sidebar={<Sidebar />} collapsed={sidebarCollapsed} contentClassName={contentClassName}>
      {children}
    </MissionControlAppShell>
  );
}
