import * as Sentry from "@sentry/react";
import type { ReactNode } from "react";
import { lazy, Suspense, useEffect } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router";
import AboutPage from "./AboutPage";
import App from "./App";
import NotFoundPage from "./NotFoundPage";
import ProfilePage from "./ProfilePage";
import RouteErrorPage, { STALE_CHUNK_RELOAD_KEY } from "./RouteErrorPage";
import RouteLoadingFallback from "./RouteLoadingFallback";
import AboutPrivacyPage from "./about/AboutPrivacyPage";
import AboutTermsPage from "./about/AboutTermsPage";
import FriendProfilePage from "./friend/FriendProfilePage";
import AppLayout from "./layout";
import {
  LegacyRedirectPlansTemplateDetail,
  LegacyRedirectPlansWeekDetail,
} from "./meal/mealLegacyRedirects";
import StaffRoute from "./staff/StaffRoute";
import { useAppSession } from "./auth/AppSessionContext";

const QuotesFeedPage = lazy(() => import("./quotes/QuotesFeedPage"));
const ClosetPage = lazy(() => import("./closet/ClosetPage"));
const ClosetItemDetailPage = lazy(
  () => import("./closet/ClosetItemDetailPage"),
);
const SongadayLayout = lazy(() => import("./songaday/SongadayLayout"));
const SongadayPage = lazy(() => import("./songaday/SongadayPage"));
const SongadayArchivePage = lazy(
  () => import("./songaday/SongadayArchivePage"),
);
const SongadayEntryDetailPage = lazy(
  () => import("./songaday/SongadayEntryDetailPage"),
);
const ClickerLayout = lazy(() => import("./clicker/ClickerLayout"));
const ClickerLobbyPage = lazy(() => import("./clicker/ClickerLobbyPage"));
const ClickerGamePage = lazy(() => import("./clicker/ClickerGamePage"));
const ClickerCatalogAdminPage = lazy(
  () => import("./clicker/ClickerCatalogAdminPage"),
);
const WhatIfLayout = lazy(() => import("./whatif/WhatIfLayout"));
const WhatIfEntryPage = lazy(() => import("./whatif/WhatIfEntryPage"));
const WhatIfAdminPage = lazy(() => import("./whatif/WhatIfAdminPage"));
const WhatIfLobbyPage = lazy(() => import("./whatif/WhatIfLobbyPage"));
const WhatIfPlayPage = lazy(() => import("./whatif/WhatIfPlayPage"));
const WhatIfHandPage = lazy(() => import("./whatif/WhatIfHandPage"));
const QffLayout = lazy(() => import("./qff/QffLayout"));
const QffLobbyPage = lazy(() => import("./qff/QffLobbyPage"));
const QffPlayersHandbookPage = lazy(
  () => import("./qff/QffPlayersHandbookPage"),
);
const QffCreatePage = lazy(() => import("./qff/QffCreatePage"));
const QffPlayPage = lazy(() => import("./qff/QffPlayPage"));
const QffDmStaffLayout = lazy(() => import("./qff/QffDmStaffLayout"));
const QffDmLobbyPage = lazy(() => import("./qff/QffDmLobbyPage"));
const QffDmPage = lazy(() => import("./qff/QffDmPage"));
const QffDmItemsPage = lazy(() => import("./qff/QffDmItemsPage"));
const QffDmMonstersPage = lazy(() => import("./qff/QffDmMonstersPage"));
const QffDmClassesPage = lazy(() => import("./qff/QffDmClassesPage"));
const QffDmInteractablesPage = lazy(
  () => import("./qff/QffDmInteractablesPage"),
);
const QffDmNpcsPage = lazy(() => import("./qff/QffDmNpcsPage"));
const QffDmQuestsPage = lazy(() => import("./qff/QffDmQuestsPage"));
const QffDmIneffectiveInputsPage = lazy(
  () => import("./qff/QffDmIneffectiveInputsPage"),
);
const QffDmShopPage = lazy(() => import("./qff/QffDmShopPage"));
const QffDmCombatSimPage = lazy(() => import("./qff/QffDmCombatSimPage"));
const MealLayout = lazy(() => import("./meal/MealLayout"));
const MealHomePage = lazy(() => import("./meal/MealHomePage"));
const MealMealsPage = lazy(() => import("./meal/MealMealsPage"));
const MealSharedPage = lazy(() => import("./meal/MealSharedPage"));
const MealMealDetailPage = lazy(() => import("./meal/MealMealDetailPage"));
const MealTemplatesPage = lazy(() => import("./meal/MealTemplatesPage"));
const MealTemplateEditPage = lazy(() => import("./meal/MealTemplateEditPage"));
const MealTodayPage = lazy(() => import("./meal/MealTodayPage"));
const MealWeeksPage = lazy(() => import("./meal/MealWeeksPage"));
const MealWeekEditPage = lazy(() => import("./meal/MealWeekEditPage"));
const MealInstanceDetailPage = lazy(
  () => import("./meal/MealInstanceDetailPage"),
);
const MealGroceryPage = lazy(() => import("./meal/MealGroceryPage"));
const GamesMenu = lazy(() => import("./GamesMenu"));
const HarborLobbyPage = lazy(() => import("./harbor/HarborLobbyPage"));
const HarborRoute = lazy(() => import("./harbor/HarborRoute"));
const HarborStaffLayout = lazy(
  () => import("./harbor/staff/HarborStaffLayout"),
);
const HarborStaffLobbyPage = lazy(
  () => import("./harbor/staff/HarborStaffLobbyPage"),
);
const HarborStaffDefPage = lazy(
  () => import("./harbor/staff/HarborStaffDefPage"),
);
const HarborStaffPlaytestPage = lazy(
  () => import("./harbor/staff/HarborStaffPlaytestPage"),
);
const HarborStaffStagesPage = lazy(
  () => import("./harbor/staff/HarborStaffStagesPage"),
);
const CalendarPage = lazy(() => import("./calendar/CalendarPage"));
const CalendarDayPage = lazy(() => import("./calendar/CalendarDayPage"));
const PondsteadHubLayout = lazy(() => import("./pondstead/PondsteadHubLayout"));
const PondsteadWelcomePage = lazy(() => import("./pondstead/PondsteadWelcomePage"));
const PondsteadCampaignsListPage = lazy(
  () => import("./pondstead/PondsteadCampaignsListPage"),
);
const PondsteadCampaignLobbyPage = lazy(
  () => import("./pondstead/PondsteadCampaignLobbyPage"),
);
const PondsteadMapPage = lazy(() => import("./pondstead/PondsteadMapPage"));

/** Runs only after Suspense resolves — lazy chunk loaded successfully; reset stale-deploy reload guard. */
function LazyRouteLoadedProbe() {
  useEffect(() => {
    try {
      sessionStorage.removeItem(STALE_CHUNK_RELOAD_KEY);
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}

function lazyRouteElement(element: ReactNode): ReactNode {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <>
        <LazyRouteLoadedProbe />
        {element}
      </>
    </Suspense>
  );
}

function RequireAuthenticatedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAppSession();
  if (isLoading) {
    return <RouteLoadingFallback />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function authedRouteElement(element: ReactNode): ReactNode {
  return <RequireAuthenticatedRoute>{element}</RequireAuthenticatedRoute>;
}

const sentryCreateBrowserRouter =
  Sentry.wrapCreateBrowserRouterV7(createBrowserRouter);

export const router = sentryCreateBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        index: true,
        element: <App />,
      },
      {
        path: "games",
        element: authedRouteElement(lazyRouteElement(<GamesMenu />)),
      },
      {
        path: "harbor",
        element: authedRouteElement(lazyRouteElement(<HarborLobbyPage />)),
      },
      {
        path: "harbor/play",
        element: authedRouteElement(lazyRouteElement(<HarborRoute />)),
      },
      {
        path: "harbor/play/:gameId",
        element: <Navigate to="/harbor/play" replace />,
      },
      {
        path: "harbor/age10",
        element: <Navigate to="/harbor?stage=12" replace />,
      },
      {
        path: "harbor/staff",
        element: authedRouteElement(lazyRouteElement(<HarborStaffLayout />)),
        children: [
          { index: true, element: lazyRouteElement(<HarborStaffLobbyPage />) },
          {
            path: "ships",
            element: lazyRouteElement(
              <HarborStaffDefPage defType="ships" title="Ships" />,
            ),
          },
          {
            path: "buildings",
            element: lazyRouteElement(
              <HarborStaffDefPage defType="buildings" title="Buildings" />,
            ),
          },
          {
            path: "operations",
            element: lazyRouteElement(
              <HarborStaffDefPage defType="operations" title="Operations" />,
            ),
          },
          {
            path: "arrivals",
            element: lazyRouteElement(
              <HarborStaffDefPage defType="arrivals" title="Arrivals" />,
            ),
          },
          {
            path: "events",
            element: lazyRouteElement(
              <HarborStaffDefPage defType="events" title="Events" />,
            ),
          },
          {
            path: "consequences",
            element: lazyRouteElement(
              <HarborStaffDefPage defType="consequences" title="Consequences" />,
            ),
          },
          {
            path: "policies",
            element: lazyRouteElement(
              <HarborStaffDefPage defType="policies" title="Policies" />,
            ),
          },
          {
            path: "doctrines",
            element: lazyRouteElement(
              <HarborStaffDefPage defType="doctrines" title="Doctrines" />,
            ),
          },
          {
            path: "ship_upgrades",
            element: lazyRouteElement(
              <HarborStaffDefPage
                defType="ship_upgrades"
                title="Ship upgrades"
              />,
            ),
          },
          {
            path: "stages",
            element: lazyRouteElement(<HarborStaffStagesPage />),
          },
          {
            path: "playtest",
            element: lazyRouteElement(<HarborStaffPlaytestPage />),
          },
        ],
      },
      {
        path: "about",
        element: <AboutPage />,
      },
      {
        path: "about/privacy",
        element: <AboutPrivacyPage />,
      },
      {
        path: "about/terms",
        element: <AboutTermsPage />,
      },
      {
        path: "profile",
        element: authedRouteElement(<ProfilePage />),
      },
      {
        path: "staff",
        element: authedRouteElement(<StaffRoute />),
      },
      {
        path: "quotes",
        element: authedRouteElement(lazyRouteElement(<QuotesFeedPage />)),
      },
      {
        path: "closet",
        element: authedRouteElement(lazyRouteElement(<ClosetPage />)),
      },
      {
        path: "calendar",
        element: authedRouteElement(<Outlet />),
        children: [
          { index: true, element: lazyRouteElement(<CalendarPage />) },
          {
            path: "day/:date",
            element: lazyRouteElement(<CalendarDayPage />),
          },
        ],
      },
      {
        path: "pondstead",
        element: authedRouteElement(<Outlet />),
        children: [
          {
            element: lazyRouteElement(<PondsteadHubLayout />),
            children: [
              { index: true, element: lazyRouteElement(<PondsteadWelcomePage />) },
              {
                path: "campaigns",
                element: lazyRouteElement(<PondsteadCampaignsListPage />),
              },
              {
                path: "campaign/:campaignId",
                element: lazyRouteElement(<PondsteadCampaignLobbyPage />),
              },
            ],
          },
          {
            path: "play/:campaignId?",
            element: lazyRouteElement(<PondsteadMapPage />),
          },
        ],
      },
      {
        path: "closet/items/:itemId",
        element: authedRouteElement(lazyRouteElement(<ClosetItemDetailPage />)),
      },
      {
        path: "songaday",
        element: authedRouteElement(lazyRouteElement(<SongadayLayout />)),
        children: [
          {
            index: true,
            element: lazyRouteElement(<SongadayPage />),
          },
          {
            path: "archive",
            element: lazyRouteElement(<SongadayArchivePage />),
          },
          {
            path: "entries/:entryId",
            element: lazyRouteElement(<SongadayEntryDetailPage />),
          },
        ],
      },
      {
        path: "meal",
        element: authedRouteElement(lazyRouteElement(<MealLayout />)),
        children: [
          {
            index: true,
            element: <Navigate to="/meal/today" replace />,
          },
          {
            path: "recipes",
            element: <Navigate to="/meal/plan/meals" replace />,
          },
          {
            path: "meals",
            element: <Navigate to="/meal/plan/meals" replace />,
          },
          {
            path: "templates",
            element: <Navigate to="/meal/plan/templates" replace />,
          },
          {
            path: "weeks",
            element: <Navigate to="/meal/plan/plans" replace />,
          },
          {
            path: "weeks/:id",
            element: <LegacyRedirectPlansWeekDetail />,
          },
          {
            path: "templates/:id",
            element: <LegacyRedirectPlansTemplateDetail />,
          },
          {
            path: "today",
            element: lazyRouteElement(<MealTodayPage />),
          },
          {
            path: "plan",
            children: [
              {
                index: true,
                element: <Navigate to="/meal/plan/plans" replace />,
              },
              { path: "plans", element: lazyRouteElement(<MealWeeksPage />) },
              {
                path: "plans/new",
                element: lazyRouteElement(<MealWeekEditPage />),
              },
              {
                path: "plans/:id",
                element: lazyRouteElement(<MealInstanceDetailPage />),
              },
              {
                path: "templates",
                element: lazyRouteElement(<MealTemplatesPage />),
              },
              {
                path: "templates/:id",
                element: lazyRouteElement(<MealTemplateEditPage />),
              },
              { path: "shared", element: lazyRouteElement(<MealSharedPage />) },
              { path: "meals", element: lazyRouteElement(<MealMealsPage />) },
              {
                path: "meals/:id",
                element: lazyRouteElement(<MealMealDetailPage />),
              },
            ],
          },
          {
            path: "plans/:tab",
            element: <Navigate to="/meal/plan/plans" replace />,
          },
          {
            path: "plans/today",
            element: <Navigate to="/meal/today" replace />,
          },
          {
            path: "plans/weeks",
            element: <Navigate to="/meal/plan/plans" replace />,
          },
          {
            path: "plans/templates",
            element: <Navigate to="/meal/plan/templates" replace />,
          },
          {
            path: "plans/weeks/:id",
            element: <LegacyRedirectPlansWeekDetail />,
          },
          {
            path: "plans/templates/:id",
            element: <LegacyRedirectPlansTemplateDetail />,
          },
          {
            path: "menu/meals",
            element: <Navigate to="/meal/plan/meals" replace />,
          },
          {
            path: "menu/meals/:id",
            element: lazyRouteElement(<MealMealDetailPage />),
          },
          {
            path: "grocery",
            children: [
              { index: true, element: lazyRouteElement(<MealGroceryPage />) },
            ],
          },
          {
            path: "settings",
            children: [
              { index: true, element: lazyRouteElement(<MealHomePage />) },
            ],
          },
        ],
      },
      {
        path: "clicker",
        element: authedRouteElement(lazyRouteElement(<ClickerLayout />)),
        children: [
          { index: true, element: lazyRouteElement(<ClickerLobbyPage />) },
          { path: "play", element: lazyRouteElement(<ClickerGamePage />) },
          {
            path: "dev/catalog",
            element: lazyRouteElement(<ClickerCatalogAdminPage />),
          },
        ],
      },
      {
        path: "whatif",
        element: lazyRouteElement(<WhatIfLayout />),
        children: [
          { index: true, element: lazyRouteElement(<WhatIfEntryPage />) },
          { path: "admin", element: lazyRouteElement(<WhatIfAdminPage />) },
          {
            path: "lobby/:code",
            element: lazyRouteElement(<WhatIfLobbyPage />),
          },
          { path: "play/:code", element: lazyRouteElement(<WhatIfPlayPage />) },
          { path: "hand/:code", element: lazyRouteElement(<WhatIfHandPage />) },
        ],
      },
      {
        path: "create",
        element: authedRouteElement(<Navigate to="/qff/create" replace />),
      },
      {
        path: "qff",
        element: authedRouteElement(lazyRouteElement(<QffLayout />)),
        children: [
          { index: true, element: lazyRouteElement(<QffLobbyPage />) },
          {
            path: "handbook",
            element: lazyRouteElement(<QffPlayersHandbookPage />),
          },
          { path: "create", element: lazyRouteElement(<QffCreatePage />) },
          { path: "play", element: lazyRouteElement(<QffPlayPage />) },
          {
            path: "dm",
            element: lazyRouteElement(<QffDmStaffLayout />),
            children: [
              { index: true, element: lazyRouteElement(<QffDmLobbyPage />) },
              { path: "world", element: lazyRouteElement(<QffDmPage />) },
              { path: "items", element: lazyRouteElement(<QffDmItemsPage />) },
              {
                path: "monsters",
                element: lazyRouteElement(<QffDmMonstersPage />),
              },
              {
                path: "classes",
                element: lazyRouteElement(<QffDmClassesPage />),
              },
              {
                path: "quests",
                element: lazyRouteElement(<QffDmQuestsPage />),
              },
              { path: "npcs", element: lazyRouteElement(<QffDmNpcsPage />) },
              {
                path: "interactables",
                element: lazyRouteElement(<QffDmInteractablesPage />),
              },
              {
                path: "ineffective-inputs",
                element: lazyRouteElement(<QffDmIneffectiveInputsPage />),
              },
              { path: "shops", element: lazyRouteElement(<QffDmShopPage />) },
              {
                path: "combat-sim",
                element: lazyRouteElement(<QffDmCombatSimPage />),
              },
            ],
          },
        ],
      },
      {
        path: "quotes/public",
        element: <Navigate to="/quotes" replace />,
      },
      {
        path: "friend/:userId",
        element: <FriendProfilePage />,
      },
      {
        path: "friends",
        element: authedRouteElement(<Navigate to="/profile?tab=friends" replace />),
      },
      {
        path: "users/:email/public-quotes",
        element: <FriendProfilePage />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
