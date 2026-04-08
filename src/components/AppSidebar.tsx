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
  { title: "??????????", url: "/prepayments", icon: CreditCard, section: "prepayments" as const },
  { title: "???", url: "/bar", icon: Wine, section: "bar" as const },
  { title: "?????????", url: ANALYTICS_ROUTE_PATHS.root, icon: BarChart3, section: "analytics" as const },
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
  const roleLabel = role ? roleLabels[role] : "????????????";

  const handleSidebarItemClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border/60">
      <SidebarContent className="pt-6">
        <div className={`mb-6 px-5 ${collapsed ? "px-2" : ""}`}>
          {collapsed ? (
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-sidebar-primary/20 text-lg font-serif font-bold text-sidebar-primary">
              R
            </span>
          ) : (
            <div className="space-y-2">
              <h1 className="font-serif text-xl font-bold tracking-tight text-sidebar-primary">RestaurantOS</h1>
              <p className="text-sm text-sidebar-foreground/70">???????? ????????? ?????</p>
              <div className="h-0.5 w-10 rounded-full bg-sidebar-primary/60" />
            </div>
          )}
        </div>

        <SidebarGroup className="px-4">
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    size="lg"
                    isActive={item.section === "analytics" ? analyticsActive : location.pathname === item.url}
                    className="rounded-full border border-sidebar-border/70 bg-sidebar/40 px-4 py-2.5 text-[15px] font-semibold text-sidebar-foreground/80 transition-all hover:border-primary/60 hover:bg-primary/10 hover:text-sidebar-foreground data-[active=true]:border-primary/70 data-[active=true]:bg-primary/20 data-[active=true]:text-white data-[active=true]:shadow-[0_0_0_2px_rgba(0,217,255,0.2)]"
                  >
                    <NavLink
                      to={item.section === "analytics" ? ANALYTICS_ROUTE_PATHS.financial : item.url}
                      end={item.section !== "analytics"}
                      onClick={handleSidebarItemClick}
                      className="w-full"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>

                  {item.section === "analytics" && analyticsVisible && !collapsed ? (
                    <SidebarMenuSub className="mt-2 border-sidebar-border/50">
                      {ANALYTICS_SIDEBAR_ITEMS.filter((subItem) => !subItem.adminOnly || role === "admin").map(
                        (subItem) => (
                          <SidebarMenuSubItem key={subItem.url}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={location.pathname === subItem.url}
                              className="rounded-full border border-sidebar-border/50 bg-sidebar/30 px-3 py-1.5 text-xs font-semibold text-sidebar-foreground/70 transition-all hover:border-primary/60 hover:bg-primary/10 hover:text-white data-[active=true]:border-primary/70 data-[active=true]:bg-primary/20 data-[active=true]:text-white"
                            >
                              <NavLink to={subItem.url} end onClick={handleSidebarItemClick} className="w-full">
                                <span>{subItem.title}</span>
                              </NavLink>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ),
                      )}
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
            <button className="flex w-full items-center gap-3 rounded-2xl border border-sidebar-border/60 bg-sidebar/40 px-3 py-2 text-sm text-sidebar-foreground/80 transition-all hover:border-primary/60 hover:bg-primary/10">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-primary/20 text-xs font-bold text-sidebar-primary">
                {getUserBadgeText(userName, roleLabel)}
              </div>
              {!collapsed && (
                <>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm font-medium text-sidebar-accent-foreground">{userName || "????????????"}</div>
                    <div className="truncate text-xs text-sidebar-foreground/60">{roleLabel}</div>
                  </div>
                  <ChevronDown className="h-3.5 w-3.5 opacity-40" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent side="top" align="start" className="w-56">
            <DropdownMenuLabel className="space-y-1">
              <div className="truncate text-sm">{userName || "????????????"}</div>
              <div className="truncate text-xs font-normal text-muted-foreground">{userEmail || roleLabel}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              ?????
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
