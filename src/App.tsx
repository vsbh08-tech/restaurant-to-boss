import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";

import { AppLayout } from "@/components/AppLayout";
import { RoleGuard } from "@/components/RoleGuard";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RoleProvider, useRole } from "@/lib/roles";
import AnalyticsPage from "@/pages/AnalyticsPage";
import BarPage from "@/pages/BarPage";
import LoginPage from "@/pages/LoginPage";
import NotFound from "@/pages/NotFound";
import PrepaymentPage from "@/pages/PrepaymentPage";
import PublicDolgorukovskayaFriendsPage from "@/pages/PublicDolgorukovskayaFriendsPage";

const queryClient = new QueryClient();
const useHashRouter = import.meta.env.VITE_ROUTER_MODE === "hash";
const browserBasename = import.meta.env.BASE_URL === "/" ? undefined : import.meta.env.BASE_URL.replace(/\/$/, "");

function FullPageLoader() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-3">
      <div className="text-3xl">🍽️</div>
      <div className="text-sm text-muted-foreground font-medium">Загрузка...</div>
    </div>
  );
}

function ProtectedLayout() {
  const { isAuthenticated, isLoading } = useRole();

  if (isLoading) {
    return <FullPageLoader />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}

function AppRoutes() {
  const { defaultRoute } = useRole();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/dolgorukovskaya-druzya" element={<PublicDolgorukovskayaFriendsPage />} />

      <Route element={<ProtectedLayout />}>
        <Route path="/" element={<Navigate to={defaultRoute} replace />} />
        <Route
          path="/prepayments"
          element={
            <RoleGuard section="prepayments">
              <PrepaymentPage />
            </RoleGuard>
          }
        />
        <Route
          path="/bar"
          element={
            <RoleGuard section="bar">
              <BarPage />
            </RoleGuard>
          }
        />
        <Route
          path="/analytics/*"
          element={
            <RoleGuard section="analytics">
              <AnalyticsPage />
            </RoleGuard>
          }
        />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <RoleProvider>
        {useHashRouter ? (
          <HashRouter>
            <AppRoutes />
          </HashRouter>
        ) : (
          <BrowserRouter basename={browserBasename}>
            <AppRoutes />
          </BrowserRouter>
        )}
      </RoleProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
