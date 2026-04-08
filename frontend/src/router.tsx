import * as Sentry from "@sentry/react";
import { createBrowserRouter, Navigate } from "react-router";
import App from "./App";
import AppLayout from "./layout";
import NotFoundPage from "./NotFoundPage";
import ProfilePage from "./ProfilePage";
import FriendProfilePage from "./friend/FriendProfilePage";
import FriendsPage from "./friends/FriendsPage";
import QuotesFeedPage from "./quotes/QuotesFeedPage";
import ClickerCatalogAdminPage from "./clicker/ClickerCatalogAdminPage";
import ClickerGamePage from "./clicker/ClickerGamePage";
import ClickerLayout from "./clicker/ClickerLayout";
import ClickerLobbyPage from "./clicker/ClickerLobbyPage";
import WhatIfLayout from "./whatif/WhatIfLayout";
import WhatIfEntryPage from "./whatif/WhatIfEntryPage";
import WhatIfAdminPage from "./whatif/WhatIfAdminPage";
import WhatIfLobbyPage from "./whatif/WhatIfLobbyPage";
import WhatIfPlayPage from "./whatif/WhatIfPlayPage";
import WhatIfHandPage from "./whatif/WhatIfHandPage";
import StaffRoute from "./staff/StaffRoute";
import QffLayout from "./qff/QffLayout";
import QffLobbyPage from "./qff/QffLobbyPage";
import QffCreatePage from "./qff/QffCreatePage";
import QffPlayPage from "./qff/QffPlayPage";
import QffDmLobbyPage from "./qff/QffDmLobbyPage";
import QffDmPage from "./qff/QffDmPage";
import QffDmItemsPage from "./qff/QffDmItemsPage";
import QffDmClassesPage from "./qff/QffDmClassesPage";
import QffDmInteractablesPage from "./qff/QffDmInteractablesPage";
import QffDmNpcsPage from "./qff/QffDmNpcsPage";
import QffDmQuestsPage from "./qff/QffDmQuestsPage";
import ClosetPage from "./closet/ClosetPage";
import AboutPage from "./AboutPage";
import AboutPrivacyPage from "./about/AboutPrivacyPage";
import AboutTermsPage from "./about/AboutTermsPage";

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
        element: <QuotesFeedPage />,
      },
      {
        path: "closet",
        element: <ClosetPage />,
      },
      {
        path: "clicker",
        element: <ClickerLayout />,
        children: [
          { index: true, element: <ClickerLobbyPage /> },
          { path: "play", element: <ClickerGamePage /> },
          { path: "dev/catalog", element: <ClickerCatalogAdminPage /> },
        ],
      },
      {
        path: "whatif",
        element: <WhatIfLayout />,
        children: [
          { index: true, element: <WhatIfEntryPage /> },
          { path: "admin", element: <WhatIfAdminPage /> },
          { path: "lobby/:code", element: <WhatIfLobbyPage /> },
          { path: "play/:code", element: <WhatIfPlayPage /> },
          { path: "hand/:code", element: <WhatIfHandPage /> },
        ],
      },
      {
        path: "create",
        element: <Navigate to="/qff/create" replace />,
      },
      {
        path: "qff",
        element: <QffLayout />,
        children: [
          { index: true, element: <QffLobbyPage /> },
          { path: "create", element: <QffCreatePage /> },
          { path: "play", element: <QffPlayPage /> },
          { path: "dm", element: <QffDmLobbyPage /> },
          { path: "dm/world", element: <QffDmPage /> },
          { path: "dm/items", element: <QffDmItemsPage /> },
          { path: "dm/classes", element: <QffDmClassesPage /> },
          { path: "dm/quests", element: <QffDmQuestsPage /> },
          { path: "dm/npcs", element: <QffDmNpcsPage /> },
          { path: "dm/interactables", element: <QffDmInteractablesPage /> },
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
