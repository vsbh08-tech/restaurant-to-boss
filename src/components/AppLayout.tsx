import { type ReactNode } from "react";

import { AppSidebar } from "@/components/AppSidebar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useRole } from "@/lib/roles";

export function AppLayout({ children }: { children: ReactNode }) {
  const {
    availableRestaurants,
    selectedRestaurantId,
    selectedRestaurantName,
    setSelectedRestaurantId,
  } = useRole();

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur-sm px-4">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div className="hidden sm:block">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Рабочий ресторан</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {availableRestaurants.length > 1 ? (
                <Select value={selectedRestaurantId ?? ""} onValueChange={setSelectedRestaurantId}>
                  <SelectTrigger className="h-9 min-w-[220px]">
                    <SelectValue placeholder="Выберите ресторан" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRestaurants.map((restaurant) => (
                      <SelectItem key={restaurant.id} value={restaurant.id}>
                        {restaurant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : selectedRestaurantName ? (
                <Badge variant="outline" className="px-3 py-1 text-sm font-medium border-primary/30 text-primary">
                  {selectedRestaurantName}
                </Badge>
              ) : null}
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
