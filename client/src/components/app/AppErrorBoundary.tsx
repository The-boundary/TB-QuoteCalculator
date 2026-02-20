import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

type AppErrorBoundaryProps = {
  children: ReactNode;
  resetKey?: string;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  message?: string;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Unexpected application error',
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Application render failure', error, info);
  }

  componentDidUpdate(prevProps: AppErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, message: undefined });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const isChunkError = /chunk|dynamically imported module|module script/i.test(
      this.state.message ?? '',
    );

    return (
      <div className="mx-auto mt-10 w-full max-w-2xl px-4">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">We hit a page error</h2>
            <p className="text-sm text-muted-foreground">
              {isChunkError
                ? 'A new deploy may have invalidated this page bundle. Reload to continue.'
                : 'Something unexpected happened while loading this page.'}
            </p>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
}
