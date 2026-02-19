import { Maximize2, PanelLeftClose, UserRound } from 'lucide-react';

import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/stores/uiStore';
import { useAuth } from '@/context/AuthContext';

export function SettingsPage() {
  const sidebarCollapsed = useUIStore((state) => state.sidebarCollapsed);
  const setSidebarCollapsed = useUIStore((state) => state.setSidebarCollapsed);
  const wideMode = useUIStore((state) => state.wideMode);
  const setWideMode = useUIStore((state) => state.setWideMode);
  const resetInterfacePrefs = useUIStore((state) => state.resetInterfacePrefs);
  const { user, access } = useAuth();

  return (
    <>
      <PageHeader title="Settings" description="Workspace preferences" />

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-border/60 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Interface</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="flex items-center justify-between rounded-md border border-border/40 bg-card/50 px-3 py-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 rounded-md bg-[#5acfd9]/10 p-1.5 text-[#5acfd9]">
                  <Maximize2 className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">Wide Content Mode</p>
                  <p className="text-xs text-muted-foreground">
                    Expand pages to use full screen width.
                  </p>
                </div>
              </div>
              <Switch checked={wideMode} onCheckedChange={setWideMode} />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border/40 bg-card/50 px-3 py-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 rounded-md bg-[#5acfd9]/10 p-1.5 text-[#5acfd9]">
                  <PanelLeftClose className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">Collapse Sidebar</p>
                  <p className="text-xs text-muted-foreground">
                    Use icon-only navigation by default.
                  </p>
                </div>
              </div>
              <Switch checked={sidebarCollapsed} onCheckedChange={setSidebarCollapsed} />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border/40 bg-card/50 px-3 py-3">
              <div>
                <p className="text-sm font-medium text-foreground">Reset interface defaults</p>
                <p className="text-xs text-muted-foreground">
                  Return sidebar and width settings to recommended defaults.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={resetInterfacePrefs}>
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="rounded-md border border-border/40 bg-card/50 px-3 py-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                <UserRound className="h-4 w-4 text-[#5acfd9]" />
                Signed-in account
              </div>
              <p className="text-sm text-muted-foreground">{user?.email || 'No email available'}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Role: {access?.role_name || access?.role_slug || 'Unassigned'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
