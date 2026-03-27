import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center px-4">
        <div className="text-5xl mb-4">🍽️</div>
        <h1 className="mb-3 text-5xl font-bold font-serif text-foreground">404</h1>
        <p className="mb-6 text-lg text-muted-foreground">Страница не найдена</p>
        <a href="/" className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
          На главную
        </a>
      </div>
    </div>
  );
};

export default NotFound;
