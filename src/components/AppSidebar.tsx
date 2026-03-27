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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { ANALYTICS_ROUTE_PATHS, ANALYTICS_SIDEBAR_ITEMS } from "@/lib/analytics-navigation";
import { roleLabels, useRole } from "@/lib/roles";

const topLevelItems = [
  { title: "Предоплаты", url: "/prepayments", icon: CreditCard, section: "prepayments" as const },
  { title: "Бар", url: "/bar", icon: Wine, section: "bar" as const },
  { title: "Аналитика", url: ANALYTICS_ROUTE_PATHS.root, icon: BarChart3, section: "analytics" as const },
];

function getUserBadgeText(name: string | null, roleLabel: string) {
  const trimmedName = name?.trim();

  if (!trimmedName) {
    return roleLabel.slice(0, 1).toUpperCase();
  }

  return trimmedName.slice(0, 1).toUpperCase();
}

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { role, userName, userEmail, signOut, canAccess } = useRole();

  const visibleItems = topLevelItems.filter((item) => canAccess(item.section));
  const analyticsVisible = visibleItems.some((item) => item.section === "analytics");
  const analyticsActive = location.pathname.startsWith(ANALYTICS_ROUTE_PATHS.root);
  const roleLabel = role ? roleLabels[role] : "Пользователь";

  const handleSidebarItemClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="pt-5">
        <div className={`mb-8 px-4 ${collapsed ? "px-2" : ""}`}>
          {collapsed ? (
            <span className="block text-center text-lg">🍽️</span>
          ) : (
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🍽️</span>
              <div>
                <h1 className="font-serif text-base font-bold tracking-tight text-sidebar-primary">RestaurantOS</h1>
                <div className="mt-0.5 h-px w-8 rounded-full bg-sidebar-primary/40" />
              </div>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={item.section === "analytics" ? analyticsActive : location.pathname === item.url}
                  >
                    <NavLink
                      to={item.section === "analytics" ? ANALYTICS_ROUTE_PATHS.financial : item.url}
                      end={item.section !== "analytics"}
                      onClick={handleSidebarItemClick}
                      className="hover:bg-sidebar-accent/60"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>

                  {item.section === "analytics" && analyticsVisible && !collapsed ? (
                    <SidebarMenuSub>
                      {ANALYTICS_SIDEBAR_ITEMS.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.url}>
                          <SidebarMenuSubButton asChild isActive={location.pathname === subItem.url}>
                            <NavLink
                              to={subItem.url}
                              end
                              onClick={handleSidebarItemClick}
                              className="hover:bg-sidebar-accent/60"
                              activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                            >
                              <span>{subItem.title}</span>
                            </NavLink>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  ) : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary/20 text-xs font-semibold text-sidebar-primary">
                {getUserBadgeText(userName, roleLabel)}
              </div>
              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm font-medium text-sidebar-accent-foreground">{userName || "Пользователь"}</div>
                    <div className="truncate text-xs text-sidebar-foreground/60">{roleLabel}</div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 opacity-40" />
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
