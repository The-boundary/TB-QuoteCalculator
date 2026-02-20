import { Suspense, lazy } from 'react';
import { Routes, Route, Outlet, useLocation } from 'react-router-dom';
import { AppErrorBoundary } from './components/app/AppErrorBoundary';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

const LoginPage = lazy(() =>
  import('./pages/Auth/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const QuotesListPage = lazy(() =>
  import('./pages/quotes/QuotesListPage').then((m) => ({ default: m.QuotesListPage })),
);
const ProjectsHomePage = lazy(() =>
  import('./pages/projects/ProjectsHomePage').then((m) => ({ default: m.ProjectsHomePage })),
);
const ProjectDetailPage = lazy(() =>
  import('./pages/projects/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage })),
);
const QuoteDetailPage = lazy(() =>
  import('./pages/quotes/QuoteDetailPage').then((m) => ({ default: m.QuoteDetailPage })),
);
const QuoteBuilderPage = lazy(() =>
  import('./pages/quotes/QuoteBuilderPage').then((m) => ({ default: m.QuoteBuilderPage })),
);
const RateCardsPage = lazy(() =>
  import('./pages/RateCardsPage').then((m) => ({ default: m.RateCardsPage })),
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
);
const TemplatesPage = lazy(() =>
  import('./pages/TemplatesPage').then((m) => ({ default: m.TemplatesPage })),
);

function RouteFallback() {
  return <div className="h-24 animate-pulse rounded-lg border border-border/50 bg-card/40" />;
}

function AppShellLayout() {
  const location = useLocation();
  return (
    <AppShell>
      <Suspense fallback={<RouteFallback />}>
        <div key={location.pathname} className="animate-in fade-in duration-200">
          <Outlet />
        </div>
      </Suspense>
    </AppShell>
  );
}

export function App() {
  const location = useLocation();

  return (
    <AppErrorBoundary resetKey={location.pathname}>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/auth/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShellLayout />}>
              <Route path="/" element={<ProjectsHomePage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/projects/:id/quotes/:quoteId" element={<QuoteDetailPage />} />
              <Route
                path="/projects/:id/quotes/:quoteId/versions/:versionId/build"
                element={<QuoteBuilderPage />}
              />
              <Route path="/quotes" element={<QuotesListPage />} />
              <Route path="/rate-cards" element={<RateCardsPage />} />
              <Route path="/templates" element={<TemplatesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Route>
        </Routes>
      </Suspense>
    </AppErrorBoundary>
  );
}
