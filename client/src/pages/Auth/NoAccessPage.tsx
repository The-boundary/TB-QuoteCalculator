import { ShieldOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export function NoAccessPage() {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <Card className="glass-panel border-border/60 w-full max-w-md animate-float-in">
        <CardContent className="p-8">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <ShieldOff className="h-6 w-6 text-tb-flare" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">Access not enabled</h1>
              <p className="text-sm text-muted-foreground">Quote Calculator access is required</p>
            </div>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            Your account is authenticated but not assigned to Quote Calculator. Contact an admin to request access.
          </p>
          <Button className="mt-6 w-full" variant="outline" onClick={() => signOut()}>Sign out</Button>
        </CardContent>
      </Card>
    </div>
  );
}
