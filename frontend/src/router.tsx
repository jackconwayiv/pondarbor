import * as Sentry from "@sentry/react";
import { Suspense, lazy } from "react";
import type { ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import App from "./App";
import AppLayout from "./layout";
import NotFoundPage from "./NotFoundPage";
import ProfilePage from "./ProfilePage";
import FriendProfilePage from "./friend/FriendProfilePage";
import FriendsPage from "./friends/FriendsPage";
import StaffRoute from "./staff/StaffRoute";
import AboutPage from "./AboutPage";
import AboutPrivacyPage from "./about/AboutPrivacyPage";
import AboutTermsPage from "./about/AboutTermsPage";
import RouteLoadingFallback from "./RouteLoadingFallback";
import {
  LegacyRedirectPlansTemplateDetail,
  LegacyRedirectPlansWeekDetail,
} from "./meal/mealLegacyRedirects";

const QuotesFeedPage = lazy(() => import("./quotes/QuotesFeedPage"));
const ClosetPage = lazy(() => import("./closet/ClosetPage"));
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
const QffCreatePage = lazy(() => import("./qff/QffCreatePage"));
const QffPlayPage = lazy(() => import("./qff/QffPlayPage"));
const QffDmLobbyPage = lazy(() => import("./qff/QffDmLobbyPage"));
const QffDmPage = lazy(() => import("./qff/QffDmPage"));
const QffDmItemsPage = lazy(() => import("./qff/QffDmItemsPage"));
const QffDmClassesPage = lazy(() => import("./qff/QffDmClassesPage"));
const QffDmInteractablesPage = lazy(() => import("./qff/QffDmInteractablesPage"));
const QffDmNpcsPage = lazy(() => import("./qff/QffDmNpcsPage"));
const QffDmQuestsPage = lazy(() => import("./qff/QffDmQuestsPage"));
const MealLayout = lazy(() => import("./meal/MealLayout"));
const MealHomePage = lazy(() => import("./meal/MealHomePage"));
const MealRecipesPage = lazy(() => import("./meal/MealRecipesPage"));
const MealRecipeDetailPage = lazy(() => import("./meal/MealRecipeDetailPage"));
const MealMealsPage = lazy(() => import("./meal/MealMealsPage"));
const MealMealDetailPage = lazy(() => import("./meal/MealMealDetailPage"));
const MealTemplatesPage = lazy(() => import("./meal/MealTemplatesPage"));
const MealTemplateEditPage = lazy(() => import("./meal/MealTemplateEditPage"));
const MealTodayPage = lazy(() => import("./meal/MealTodayPage"));
const MealWeeksPage = lazy(() => import("./meal/MealWeeksPage"));
const MealInstanceDetailPage = lazy(() => import("./meal/MealInstanceDetailPage"));
const MealGroceryPage = lazy(() => import("./meal/MealGroceryPage"));

function lazyRouteElement(element: ReactNode): ReactNode {
  return <Suspense fallback={<RouteLoadingFallback />}>{element}</Suspense>;
}

const sentryCreateBrowserRouter = Sentry.wrapCreateBrowserRouterV7(
  createBrowserRouter,
);

export const router = sentryCreateBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <App />,
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
        element: <ProfilePage />,
      },
      {
        path: "staff",
        element: <StaffRoute />,
      },
      {
        path: "quotes",
        element: lazyRouteElement(<QuotesFeedPage />),
      },
      {
        path: "closet",
        element: lazyRouteElement(<ClosetPage />),
      },
      {
        path: "meal",
        element: lazyRouteElement(<MealLayout />),
        children: [
          {
            index: true,
            element: <Navigate to="/meal/plans/today" replace />,
          },
          {
            path: "recipes",
            element: <Navigate to="/meal/menu/recipes" replace />,
          },
          {
            path: "meals",
            element: <Navigate to="/meal/menu/meals" replace />,
          },
          {
            path: "templates",
            element: <Navigate to="/meal/plans/templates" replace />,
          },
          {
            path: "weeks",
            element: <Navigate to="/meal/plans/today" replace />,
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
            path: "plans",
            children: [
              {
                index: true,
                element: <Navigate to="/meal/plans/today" replace />,
              },
              { path: "today", element: lazyRouteElement(<MealTodayPage />) },
              { path: "weeks", element: lazyRouteElement(<MealWeeksPage />) },
              {
                path: "weeks/:id",
                element: lazyRouteElement(<MealInstanceDetailPage />),
              },
              { path: "templates", element: lazyRouteElement(<MealTemplatesPage />) },
              {
                path: "templates/:id",
                element: lazyRouteElement(<MealTemplateEditPage />),
              },
            ],
          },
          {
            path: "menu",
            children: [
              {
                index: true,
                element: <Navigate to="/meal/menu/meals" replace />,
              },
              { path: "meals/:id", element: lazyRouteElement(<MealMealDetailPage />) },
              { path: "meals", element: lazyRouteElement(<MealMealsPage />) },
              { path: "recipes", element: lazyRouteElement(<MealRecipesPage />) },
              { path: "recipes/:id", element: lazyRouteElement(<MealRecipeDetailPage />) },
            ],
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
        element: lazyRouteElement(<ClickerLayout />),
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
        element: <Navigate to="/qff/create" replace />,
      },
      {
        path: "qff",
        element: lazyRouteElement(<QffLayout />),
        children: [
          { index: true, element: lazyRouteElement(<QffLobbyPage />) },
          { path: "create", element: lazyRouteElement(<QffCreatePage />) },
          { path: "play", element: lazyRouteElement(<QffPlayPage />) },
          { path: "dm", element: lazyRouteElement(<QffDmLobbyPage />) },
          { path: "dm/world", element: lazyRouteElement(<QffDmPage />) },
          { path: "dm/items", element: lazyRouteElement(<QffDmItemsPage />) },
          {
            path: "dm/classes",
            element: lazyRouteElement(<QffDmClassesPage />),
          },
          { path: "dm/quests", element: lazyRouteElement(<QffDmQuestsPage />) },
          { path: "dm/npcs", element: lazyRouteElement(<QffDmNpcsPage />) },
          {
            path: "dm/interactables",
            element: lazyRouteElement(<QffDmInteractablesPage />),
          },
        ],
      },
      {
        path: "quotes/public",
        element: <Navigate to="/quotes?tab=published" replace />,
      },
      {
        path: "friend/:userId",
        element: <FriendProfilePage />,
      },
      {
        path: "friends",
        element: <FriendsPage />,
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
