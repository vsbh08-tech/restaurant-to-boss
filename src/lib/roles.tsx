/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

export type UserRole = "bartender" | "manager" | "owner" | "supervisor" | "admin";
export type AppSection = "bar" | "prepayments" | "analytics";

export type AppRestaurant = {
  id: string;
  name: string;
};

export type DemoAuthPayload = {
  role: UserRole;
  availableRestaurants: AppRestaurant[];
  selectedRestaurantId: string | null;
  userName?: string | null;
};

export type UserProfileRow = {
  id: string;
  full_name: string | null;
  role: string | null;
  restaurant_id: string | null;
  email: string | null;
};

export type UserRestaurantRow = {
  user_id: string;
  restaurant_id: string;
};

type RoleContextType = {
  role: UserRole | null;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  isAuthenticated: boolean;
  isDemoSession: boolean;
  isLoading: boolean;
  availableRestaurants: AppRestaurant[];
  selectedRestaurantId: string | null;
  selectedRestaurantName: string | null;
  defaultRoute: string;
  setSelectedRestaurantId: (restaurantId: string) => void;
  signInDemo: (payload: DemoAuthPayload) => void;
  signOut: () => Promise<void>;
  canAccess: (section: AppSection) => boolean;
};

type ResolvedUserState = {
  role: UserRole;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  availableRestaurants: AppRestaurant[];
  selectedRestaurantId: string | null;
};

type DirectoryLookupClient = {
  from: <T extends "user_profiles" | "user_restaurants">(table: T) => T extends "user_profiles"
    ? {
        select: (query: string) => {
          eq: (column: string, value: string) => {
            maybeSingle: () => Promise<{ data: UserProfileRow | null; error: Error | null }>;
          };
        };
      }
    : {
        select: (query: string) => Promise<{ data: UserRestaurantRow[] | null; error: Error | null }>;
      };
};

const EMPTY_STATE: Omit<RoleContextType, "setSelectedRestaurantId" | "signOut" | "canAccess"> = {
  role: null,
  userId: null,
  userName: null,
  userEmail: null,
  isAuthenticated: false,
  isDemoSession: false,
  isLoading: true,
  availableRestaurants: [],
  selectedRestaurantId: null,
  selectedRestaurantName: null,
  defaultRoute: "/bar",
  signInDemo: () => undefined,
};

const RoleContext = createContext<RoleContextType | undefined>(undefined);

const accessMap: Record<UserRole, Set<AppSection>> = {
  bartender: new Set(["bar"]),
  manager: new Set(["prepayments", "bar"]),
  owner: new Set(["analytics"]),
  supervisor: new Set(["prepayments", "bar", "analytics"]),
  admin: new Set(["prepayments", "bar", "analytics"]),
};

export const roleLabels: Record<UserRole, string> = {
  bartender: "Бармен",
  manager: "Менеджер",
  owner: "Собственник",
  supervisor: "Управляющий",
  admin: "Админ",
};

const GLOBAL_ROLES = new Set<UserRole>(["supervisor", "admin"]);
const PENDING_RESTAURANT_KEY = "auth:pending-restaurant";
const DEMO_AUTH_KEY = "auth:demo-session";

type StoredDemoAuth = {
  role: UserRole;
  userName: string | null;
  availableRestaurants: AppRestaurant[];
  selectedRestaurantId: string | null;
};

function getStoredRestaurantKey(userId: string) {
  return `auth:selected-restaurant:${userId}`;
}

export function mapDatabaseRole(role: string | null): UserRole | null {
  switch (role?.trim()) {
    case "Бармен":
      return "bartender";
    case "Менеджер":
      return "manager";
    case "Собственник":
      return "owner";
    case "Управляющий":
      return "supervisor";
    case "Админ":
      return "admin";
    default:
      return null;
  }
}

export function isGlobalRole(role: UserRole | null) {
  return role !== null && GLOBAL_ROLES.has(role);
}

export function getDefaultRoute(role: UserRole | null) {
  switch (role) {
    case "manager":
      return "/prepayments";
    case "owner":
      return "/analytics";
    case "supervisor":
      return "/analytics";
    case "admin":
      return "/analytics";
    case "bartender":
    default:
      return "/bar";
  }
}

export function rememberPendingRestaurantSelection(restaurantId: string) {
  localStorage.setItem(PENDING_RESTAURANT_KEY, restaurantId);
}

export function getProfileRestaurantIds(
  profile: Pick<UserProfileRow, "id" | "restaurant_id">,
  role: UserRole,
  links: UserRestaurantRow[],
  restaurants: AppRestaurant[],
) {
  if (isGlobalRole(role)) {
    return restaurants.map((restaurant) => restaurant.id);
  }

  const restaurantIds = new Set<string>();

  if (profile.restaurant_id) {
    restaurantIds.add(profile.restaurant_id);
  }

  links.forEach((link) => {
    if (link.user_id === profile.id) {
      restaurantIds.add(link.restaurant_id);
    }
  });

  return Array.from(restaurantIds);
}

function buildSelectedRestaurantId(userId: string, restaurants: AppRestaurant[]) {
  if (restaurants.length === 0) {
    localStorage.removeItem(PENDING_RESTAURANT_KEY);
    localStorage.removeItem(getStoredRestaurantKey(userId));
    return null;
  }

  const availableIds = restaurants.map((restaurant) => restaurant.id);
  const pendingRestaurantId = localStorage.getItem(PENDING_RESTAURANT_KEY);
  const storedRestaurantId = localStorage.getItem(getStoredRestaurantKey(userId));

  const nextRestaurantId = [pendingRestaurantId, storedRestaurantId, restaurants[0]?.id].find(
    (restaurantId): restaurantId is string => Boolean(restaurantId && availableIds.includes(restaurantId)),
  );

  if (nextRestaurantId) {
    localStorage.setItem(getStoredRestaurantKey(userId), nextRestaurantId);
  }

  localStorage.removeItem(PENDING_RESTAURANT_KEY);

  return nextRestaurantId ?? null;
}

function loadDemoAuthState(): StoredDemoAuth | null {
  const rawValue = localStorage.getItem(DEMO_AUTH_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as StoredDemoAuth;

    if (!parsed.role || !Array.isArray(parsed.availableRestaurants)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function persistDemoAuthState(payload: StoredDemoAuth) {
  localStorage.setItem(DEMO_AUTH_KEY, JSON.stringify(payload));
}

function clearDemoAuthState() {
  localStorage.removeItem(DEMO_AUTH_KEY);
}

async function resolveUserState(session: Session): Promise<ResolvedUserState> {
  const supabaseDirectory = supabase as unknown as DirectoryLookupClient;

  const [
    restaurantsResult,
    profileResult,
    userRestaurantsResult,
  ] = await Promise.all([
    supabase.from("restaurants").select("id, name").order("name", { ascending: true }),
    supabaseDirectory
      .from("user_profiles")
      .select("id, full_name, role, restaurant_id, email")
      .eq("id", session.user.id)
      .maybeSingle(),
    supabaseDirectory.from("user_restaurants").select("user_id, restaurant_id"),
  ]);

  if (restaurantsResult.error) {
    throw restaurantsResult.error;
  }

  if (profileResult.error) {
    throw profileResult.error;
  }

  if (userRestaurantsResult.error) {
    throw userRestaurantsResult.error;
  }

  const profile = profileResult.data;
  const role = mapDatabaseRole(profile?.role ?? null);

  if (!profile || !role) {
    throw new Error("Для пользователя не найден профиль или не настроена роль.");
  }

  const restaurants = (restaurantsResult.data ?? []).sort((left, right) => left.name.localeCompare(right.name, "ru"));
  const userRestaurants = (userRestaurantsResult.data ?? []).filter((item) => item.user_id === session.user.id);
  const restaurantIds = new Set(getProfileRestaurantIds(profile, role, userRestaurants, restaurants));
  const availableRestaurants = restaurants.filter((restaurant) => restaurantIds.has(restaurant.id));
  const selectedRestaurantId = buildSelectedRestaurantId(session.user.id, availableRestaurants);

  return {
    role,
    userId: session.user.id,
    userName: profile.full_name || session.user.email || "Пользователь",
    userEmail: profile.email || session.user.email || null,
    availableRestaurants,
    selectedRestaurantId,
  };
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(EMPTY_STATE);
  const syncIdRef = useRef(0);

  const setSelectedRestaurantId = useCallback((restaurantId: string) => {
    setState((current) => {
      if (!current.userId) {
        return current;
      }

      const nextRestaurant = current.availableRestaurants.find((item) => item.id === restaurantId);
      if (!nextRestaurant) {
        return current;
      }

      if (current.isDemoSession) {
        persistDemoAuthState({
          role: current.role!,
          userName: current.userName,
          availableRestaurants: current.availableRestaurants,
          selectedRestaurantId: nextRestaurant.id,
        });
      } else {
        localStorage.setItem(getStoredRestaurantKey(current.userId), nextRestaurant.id);
      }

      return {
        ...current,
        selectedRestaurantId: nextRestaurant.id,
        selectedRestaurantName: nextRestaurant.name,
      };
    });
  }, []);

  const signInDemo = useCallback((payload: DemoAuthPayload) => {
    const availableRestaurants = payload.availableRestaurants.sort((left, right) => left.name.localeCompare(right.name, "ru"));
    const selectedRestaurantId =
      payload.selectedRestaurantId && availableRestaurants.some((item) => item.id === payload.selectedRestaurantId)
        ? payload.selectedRestaurantId
        : availableRestaurants[0]?.id ?? null;
    const userName = payload.userName || `Тестовый ${roleLabels[payload.role].toLowerCase()}`;

    persistDemoAuthState({
      role: payload.role,
      userName,
      availableRestaurants,
      selectedRestaurantId,
    });

    setState({
      role: payload.role,
      userId: `demo:${payload.role}`,
      userName,
      userEmail: null,
      isAuthenticated: true,
      isDemoSession: true,
      isLoading: false,
      availableRestaurants,
      selectedRestaurantId,
      selectedRestaurantName:
        availableRestaurants.find((restaurant) => restaurant.id === selectedRestaurantId)?.name ?? null,
      defaultRoute: getDefaultRoute(payload.role),
      signInDemo: () => undefined,
    });
  }, []);

  const syncSession = useCallback(async (session: Session | null, shouldNotify = true) => {
    const syncId = syncIdRef.current + 1;
    syncIdRef.current = syncId;

    if (!session) {
      const demoState = loadDemoAuthState();

      if (demoState) {
        setState({
          role: demoState.role,
          userId: `demo:${demoState.role}`,
          userName: demoState.userName,
          userEmail: null,
          isAuthenticated: true,
          isDemoSession: true,
          isLoading: false,
          availableRestaurants: demoState.availableRestaurants,
          selectedRestaurantId: demoState.selectedRestaurantId,
          selectedRestaurantName:
            demoState.availableRestaurants.find((restaurant) => restaurant.id === demoState.selectedRestaurantId)?.name ?? null,
          defaultRoute: getDefaultRoute(demoState.role),
          signInDemo: () => undefined,
        });
        return;
      }

      setState({
        ...EMPTY_STATE,
        isLoading: false,
      });
      return;
    }

    setState((current) => ({
      ...current,
      isLoading: true,
    }));

    try {
      clearDemoAuthState();
      const resolvedState = await resolveUserState(session);

      if (syncIdRef.current !== syncId) {
        return;
      }

      const selectedRestaurantName =
        resolvedState.availableRestaurants.find((restaurant) => restaurant.id === resolvedState.selectedRestaurantId)?.name ??
        null;

      setState({
        role: resolvedState.role,
        userId: resolvedState.userId,
        userName: resolvedState.userName,
        userEmail: resolvedState.userEmail,
        isAuthenticated: true,
        isDemoSession: false,
        isLoading: false,
        availableRestaurants: resolvedState.availableRestaurants,
        selectedRestaurantId: resolvedState.selectedRestaurantId,
        selectedRestaurantName,
        defaultRoute: getDefaultRoute(resolvedState.role),
        signInDemo: () => undefined,
      });
    } catch (error) {
      if (syncIdRef.current !== syncId) {
        return;
      }

      setState({
        ...EMPTY_STATE,
        isLoading: false,
      });

      if (shouldNotify) {
        const errorMessage = error instanceof Error ? error.message : "Не удалось загрузить профиль пользователя.";
        toast.error(errorMessage);
      }

      await supabase.auth.signOut();
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setState({
          ...EMPTY_STATE,
          isLoading: false,
        });
        return;
      }

      await syncSession(data.session, false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [syncSession]);

  const signOut = useCallback(async () => {
    if (state.isDemoSession) {
      clearDemoAuthState();
      setState({
        ...EMPTY_STATE,
        isLoading: false,
      });
      return;
    }

    clearDemoAuthState();
    await supabase.auth.signOut();
  }, [state.isDemoSession]);

  const canAccess = useCallback(
    (section: AppSection) => {
      if (!state.role) return false;
      return accessMap[state.role].has(section);
    },
    [state.role],
  );

  const selectedRestaurantName = useMemo(
    () =>
      state.availableRestaurants.find((restaurant) => restaurant.id === state.selectedRestaurantId)?.name ?? null,
    [state.availableRestaurants, state.selectedRestaurantId],
  );

  const value = useMemo<RoleContextType>(
    () => ({
      ...state,
      selectedRestaurantName,
      defaultRoute: getDefaultRoute(state.role),
      setSelectedRestaurantId,
      signInDemo,
      signOut,
      canAccess,
    }),
    [canAccess, selectedRestaurantName, setSelectedRestaurantId, signInDemo, signOut, state],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error("useRole must be used within RoleProvider");
  }

  return context;
}
