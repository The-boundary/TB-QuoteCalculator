import { Suspense, lazy } from 'react';
import { Routes, Route, Outlet, useLocation } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

const LoginPage = lazy(() =>
  import('./pages/Auth/LoginPage').then((m) => ({ default: m.LoginPage }))
);
const NoAccessPage = lazy(() =>
  import('./pages/Auth/NoAccessPage').then((m) => ({ default: m.NoAccessPage }))
);
const QuotesListPage = lazy(() =>
  import('./pages/quotes/QuotesListPage').then((m) => ({ default: m.QuotesListPage }))
);
const QuoteDetailPage = lazy(() =>
  import('./pages/quotes/QuoteDetailPage').then((m) => ({ default: m.QuoteDetailPage }))
);
const QuoteBuilderPage = lazy(() =>
  import('./pages/quotes/QuoteBuilderPage').then((m) => ({ default: m.QuoteBuilderPage }))
);
const RateCardsPage = lazy(() =>
  import('./pages/RateCardsPage').then((m) => ({ default: m.RateCardsPage }))
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
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
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/no-access" element={<NoAccessPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShellLayout />}>
            <Route path="/" element={<QuotesListPage />} />
            <Route path="/quotes/:id" element={<QuoteDetailPage />} />
            <Route path="/quotes/:id/versions/:versionId/build" element={<QuoteBuilderPage />} />
            <Route path="/rate-cards" element={<RateCardsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
