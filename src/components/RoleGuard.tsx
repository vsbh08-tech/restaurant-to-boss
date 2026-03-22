import { useRole, type AppSection } from "@/lib/roles";
import { type ReactNode } from "react";
import { Navigate } from "react-router-dom";

interface RoleGuardProps {
  section: AppSection;
  children: ReactNode;
}

export function RoleGuard({ section, children }: RoleGuardProps) {
  const { canAccess, defaultRoute, isAuthenticated, isLoading } = useRole();

  if (isLoading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Загрузка...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccess(section)) {
    return <Navigate to={defaultRoute} replace />;
  }

  return <>{children}</>;
}
