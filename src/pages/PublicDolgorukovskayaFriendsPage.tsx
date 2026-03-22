import AnalyticsPage from "@/pages/AnalyticsPage";

const DOLGORUKOVSKAYA_FRIENDS_SCOPE = {
  fixedRestaurantNames: ["Долгоруковская"] as string[],
  fixedOwnerNames: ["Друзья"] as string[],
  hideRestaurantFilter: true,
  hideOwnerFilter: true,
  hideArticleFilter: true,
  hideImportAction: true,
  hideTransfersTab: true,
  title: "Отчет для собственника",
  description: "Ресторан: Долгоруковская. Собственник: Друзья.",
};

export default function PublicDolgorukovskayaFriendsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <AnalyticsPage scope={DOLGORUKOVSKAYA_FRIENDS_SCOPE} />
      </main>
    </div>
  );
}
