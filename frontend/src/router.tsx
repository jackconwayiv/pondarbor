import { createBrowserRouter, Navigate } from "react-router";
import App from "./App";
import AppLayout from "./layout";
import NotFoundPage from "./NotFoundPage";
import ProfilePage from "./ProfilePage";
import FriendProfilePage from "./friend/FriendProfilePage";
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
import StaffPage from "./staff/StaffPage";
import QffLayout from "./qff/QffLayout";
import QffLobbyPage from "./qff/QffLobbyPage";
import QffCreatePage from "./qff/QffCreatePage";
import QffPlayPage from "./qff/QffPlayPage";
import QffDmLobbyPage from "./qff/QffDmLobbyPage";
import QffDmPage from "./qff/QffDmPage";
import QffDmItemsPage from "./qff/QffDmItemsPage";
import QffDmClassesPage from "./qff/QffDmClassesPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <App />,
      },
      {
        path: "profile",
        element: <ProfilePage />,
      },
      {
        path: "staff",
        element: <StaffPage />,
      },
      {
        path: "quotes",
        element: <QuotesFeedPage />,
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
        ],
      },
      {
        path: "quotes/public",
        element: <Navigate to="/quotes?tab=public" replace />,
      },
      {
        path: "friend/:userId",
        element: <FriendProfilePage />,
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
