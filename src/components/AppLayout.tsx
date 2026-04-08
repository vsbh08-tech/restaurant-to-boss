import { type ReactNode } from "react";

import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-20 shrink-0 items-center justify-between border-b border-border/60 bg-card/70 px-6 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-9 w-9 rounded-full border border-border/60 bg-card/60 text-foreground/80 hover:bg-card/90" />
              <span className="text-lg font-serif font-semibold text-foreground/90">Панель управления</span>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6">
            <div className="min-h-full rounded-2xl border border-border/60 bg-card/60 p-6 shadow-[0_18px_34px_rgba(4,12,28,0.45)]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
