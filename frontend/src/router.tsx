import { createBrowserRouter, Navigate } from "react-router";
import App from "./App";
import AppLayout from "./layout";
import NotFoundPage from "./NotFoundPage";
import ProfilePage from "./ProfilePage";
import PublicUserQuotesPage from "./quotes/PublicUserQuotesPage";
import QuotesFeedPage from "./quotes/QuotesFeedPage";
import ClickerPage from "./clicker/ClickerPage";

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
        path: "quotes",
        element: <QuotesFeedPage />,
      },
      {
        path: "clicker",
        element: <ClickerPage />,
      },
      {
        path: "quotes/public",
        element: <Navigate to="/quotes?tab=public" replace />,
      },
      {
        path: "users/:email/public-quotes",
        element: <PublicUserQuotesPage />,
      },
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
