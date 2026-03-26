export const ANALYTICS_ROUTE_PATHS = {
  root: "/analytics",
  financial: "/analytics/financial",
  cashMovement: "/analytics/cash-flow",
  owners: "/analytics/owners",
  transfers: "/analytics/transfers",
  loans: "/analytics/loans",
} as const;

export type AnalyticsWorkspaceView = "financial" | "cashMovement" | "owners" | "transfers" | "loans";

export const ANALYTICS_WORKSPACE_META: Record<
  AnalyticsWorkspaceView,
  { title: string; description?: string }
> = {
  financial: {
    title: "Финансовый результат",
    description: "Доход, расход, прибыль и структура бизнеса по выбранному срезу.",
  },
  cashMovement: {
    title: "Движение денег",
    description: "Денежные остатки, обязательные выплаты и динамика изменения денег за выбранный период.",
  },
  owners: {
    title: "Собственники",
    description: "Общий отчет и детализация расчетов с собственниками.",
  },
  transfers: {
    title: "Перемещения",
    description: "Внутригрупповое финансирование между ресторанами за период и накопленным итогом.",
  },
  loans: {
    title: "Займы",
    description: "Чистая позиция по займам, движения за период и детализация по контрагентам.",
  },
};

export const ANALYTICS_SIDEBAR_ITEMS: Array<{
  title: string;
  url: string;
  view: AnalyticsWorkspaceView;
}> = [
  {
    title: "Финансовый результат",
    url: ANALYTICS_ROUTE_PATHS.financial,
    view: "financial",
  },
  {
    title: "Движение денег",
    url: ANALYTICS_ROUTE_PATHS.cashMovement,
    view: "cashMovement",
  },
  {
    title: "Собственники",
    url: ANALYTICS_ROUTE_PATHS.owners,
    view: "owners",
  },
  {
    title: "Перемещения",
    url: ANALYTICS_ROUTE_PATHS.transfers,
    view: "transfers",
  },
  {
    title: "Займы",
    url: ANALYTICS_ROUTE_PATHS.loans,
    view: "loans",
  },
];

export function getAnalyticsWorkspaceView(pathname: string): AnalyticsWorkspaceView | null {
  if (pathname === ANALYTICS_ROUTE_PATHS.root || pathname === `${ANALYTICS_ROUTE_PATHS.root}/`) {
    return null;
  }

  if (pathname.startsWith(ANALYTICS_ROUTE_PATHS.financial)) {
    return "financial";
  }

  if (pathname.startsWith(ANALYTICS_ROUTE_PATHS.cashMovement)) {
    return "cashMovement";
  }

  if (pathname.startsWith(ANALYTICS_ROUTE_PATHS.owners)) {
    return "owners";
  }

  if (pathname.startsWith(ANALYTICS_ROUTE_PATHS.transfers)) {
    return "transfers";
  }

  if (pathname.startsWith(ANALYTICS_ROUTE_PATHS.loans)) {
    return "loans";
  }

  return null;
}
