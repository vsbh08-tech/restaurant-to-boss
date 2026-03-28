import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { roleLabels, type AppRestaurant, type UserRole, useRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

const TEST_ROLES: UserRole[] = ["bartender", "manager", "owner", "supervisor", "admin"];
const DEMO_RESTAURANTS_FALLBACK: AppRestaurant[] = [
  { id: "b367d7d7-fe85-4ca6-bdd7-502256e984cd", name: "Долгоруковская" },
  { id: "0586d755-b53a-42be-9c92-3c6348e8fb19", name: "РестПрМ" },
  { id: "70434d83-bfb0-4953-b069-4567ea94e1ff", name: "Солнцево" },
];

async function loadRestaurants() {
  const { data, error } = await supabase.from("restaurants").select("id, name").order("name", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as AppRestaurant[];
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, defaultRoute, signInDemo } = useRole();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoDialogOpen, setDemoDialogOpen] = useState(false);
  const [demoRole, setDemoRole] = useState<UserRole>("admin");
  const [demoRestaurantId, setDemoRestaurantId] = useState("");
  const [demoOwnerRestaurantIds, setDemoOwnerRestaurantIds] = useState<string[]>([]);

  const { data: restaurantsData = [] } = useQuery({
    queryKey: ["login-demo-restaurants"],
    queryFn: loadRestaurants,
  });
  const restaurants = restaurantsData.length > 0 ? restaurantsData : DEMO_RESTAURANTS_FALLBACK;

  useEffect(() => {
    if (!demoRestaurantId && restaurants.length > 0) {
      setDemoRestaurantId(restaurants[0].id);
    }
  }, [demoRestaurantId, restaurants]);

  useEffect(() => {
    if (demoRole === "supervisor" || demoRole === "admin") {
      setDemoOwnerRestaurantIds(restaurants.map((restaurant) => restaurant.id));
      return;
    }

    if (demoRole === "bartender" || demoRole === "manager") {
      setDemoOwnerRestaurantIds(demoRestaurantId ? [demoRestaurantId] : []);
    }
  }, [demoRestaurantId, demoRole, restaurants]);

  const selectedOwnerRestaurants = useMemo(
    () => restaurants.filter((restaurant) => demoOwnerRestaurantIds.includes(restaurant.id)),
    [demoOwnerRestaurantIds, restaurants],
  );

  if (!isLoading && isAuthenticated) {
    return <Navigate to={defaultRoute} replace />;
  }

  const handleSubmit = async () => {
    if (!email.trim()) {
      toast.error("Введите логин или email.");
      return;
    }

    if (!password.trim()) {
      toast.error("Введите пароль.");
      return;
    }

    try {
      setIsSubmitting(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      navigate("/", { replace: true });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Не удалось выполнить вход.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = () => {
    let availableRestaurants: AppRestaurant[] = [];

    if (demoRole === "supervisor" || demoRole === "admin") {
      availableRestaurants = restaurants;
    } else if (demoRole === "owner") {
      availableRestaurants = selectedOwnerRestaurants;
    } else {
      availableRestaurants = restaurants.filter((restaurant) => restaurant.id === demoRestaurantId);
    }

    if (availableRestaurants.length === 0) {
      toast.error("Выберите ресторан для тестового входа.");
      return;
    }

    signInDemo({
      role: demoRole,
      availableRestaurants,
      selectedRestaurantId: availableRestaurants[0]?.id ?? null,
    });

    setDemoDialogOpen(false);
    navigate("/", { replace: true });
  };

  const toggleOwnerRestaurant = (restaurantId: string) => {
    setDemoOwnerRestaurantIds((current) =>
      current.includes(restaurantId)
        ? current.filter((id) => id !== restaurantId)
        : [...current, restaurantId],
    );
  };

  return (
    <div className="min-h-screen px-4 py-10 relative overflow-hidden bg-gradient-to-br from-primary/4 via-background to-accent/3">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-primary/8 blur-[100px]" />
        <div className="absolute top-1/2 -left-32 w-[320px] h-[320px] rounded-full bg-accent/6 blur-[80px]" />
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center justify-center relative z-10">
        <Card className="w-full max-w-md border-border/50 shadow-xl shadow-primary/5 overflow-hidden">
          <div className="h-1 gradient-primary" />

          <CardHeader className="pb-4 text-center pt-10">
            <div className="mx-auto mb-5 text-4xl">🍽️</div>
            <CardTitle className="text-2xl font-serif tracking-tight">RestaurantOS</CardTitle>
            <p className="text-sm text-muted-foreground mt-1.5">Управление финансами ресторанной сети</p>
          </CardHeader>

          <CardContent className="space-y-4 pb-8">
            <div className="space-y-1.5">
              <Label>Логин / email</Label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 border-border/80 focus-visible:ring-primary"
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Пароль</Label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 border-border/80 focus-visible:ring-primary"
                autoComplete="current-password"
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !isSubmitting) {
                    void handleSubmit();
                  }
                }}
              />
            </div>

            <Button
              className="h-11 w-full gradient-primary hover:opacity-90 transition-opacity text-white border-0 shadow-md shadow-primary/20"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting || isLoading}
            >
              Войти
            </Button>

            <Dialog open={demoDialogOpen} onOpenChange={setDemoDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 hover:text-primary">
                  Тестовый вход
                </Button>
              </DialogTrigger>

              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-serif">Тестовый вход</DialogTitle>
                </DialogHeader>

                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label>Роль</Label>
                    <Select value={demoRole} onValueChange={(value) => setDemoRole(value as UserRole)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TEST_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {roleLabels[role]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {(demoRole === "bartender" || demoRole === "manager") && (
                    <div className="space-y-1.5">
                      <Label>Ресторан</Label>
                      <Select value={demoRestaurantId} onValueChange={setDemoRestaurantId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите ресторан" />
                        </SelectTrigger>
                        <SelectContent>
                          {restaurants.map((restaurant) => (
                            <SelectItem key={restaurant.id} value={restaurant.id}>
                              {restaurant.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {demoRole === "owner" && (
                    <div className="space-y-2">
                      <Label>Доступные рестораны</Label>
                      <div className="flex flex-wrap gap-2">
                        {restaurants.map((restaurant) => {
                          const active = demoOwnerRestaurantIds.includes(restaurant.id);

                          return (
                            <Button
                              key={restaurant.id}
                              type="button"
                              variant="outline"
                              className={cn(
                                "h-8 px-3 text-xs border-border hover:border-primary hover:bg-primary/5 hover:text-primary",
                                active && "border-primary bg-primary text-primary-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground",
                              )}
                              onClick={() => toggleOwnerRestaurant(restaurant.id)}
                            >
                              {restaurant.name}
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <Button className="w-full gradient-primary text-white border-0" onClick={handleDemoLogin}>
                    Войти тестово
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
