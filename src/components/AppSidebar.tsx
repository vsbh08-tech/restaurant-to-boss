import { BarChart3, ChevronDown, CreditCard, LogOut, Wine } from "lucide-react";
import { useLocation } from "react-router-dom";

import { NavLink } from "@/components/NavLink";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { roleLabels, useRole } from "@/lib/roles";

const allItems = [
  { title: "Предоплаты", url: "/prepayments", icon: CreditCard, section: "prepayments" as const },
  { title: "Бар", url: "/bar", icon: Wine, section: "bar" as const },
  { title: "Аналитика", url: "/analytics", icon: BarChart3, section: "analytics" as const },
];

function getUserBadgeText(name: string | null, roleLabel: string) {
  const trimmedName = name?.trim();

  if (!trimmedName) {
    return roleLabel.slice(0, 1).toUpperCase();
  }

  return trimmedName.slice(0, 1).toUpperCase();
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { role, userName, userEmail, signOut, canAccess } = useRole();

  const visibleItems = allItems.filter((item) => canAccess(item.section));
  const roleLabel = role ? roleLabels[role] : "Пользователь";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="pt-4">
        <div className={`px-4 mb-6 ${collapsed ? "px-2" : ""}`}>
          {collapsed ? (
            <span className="block text-center text-lg font-bold text-sidebar-primary font-serif">R</span>
          ) : (
            <div>
              <h1 className="text-lg font-bold tracking-tight text-sidebar-primary font-serif">RestaurantOS</h1>
              <div className="mt-1 h-0.5 w-10 rounded-full bg-sidebar-primary/60" />
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent/60"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
                {getUserBadgeText(userName, roleLabel)}
              </div>
              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm font-medium">{userName || "Пользователь"}</div>
                    <div className="truncate text-xs text-sidebar-foreground/70">{roleLabel}</div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="space-y-1">
              <div className="truncate text-sm">{userName || "Пользователь"}</div>
              <div className="truncate text-xs font-normal text-muted-foreground">{userEmail || roleLabel}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Выйти
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
