import { createBrowserRouter } from "react-router";
import App from "./App";
import AppLayout from "./layout";
import NotFoundPage from "./NotFoundPage";
import ProfilePage from "./ProfilePage";
import PublicQuotesPage from "./quotes/PublicQuotesPage";
import PublicUserQuotesPage from "./quotes/PublicUserQuotesPage";
import QuotesFeedPage from "./quotes/QuotesFeedPage";

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
        path: "quotes/public",
        element: <PublicQuotesPage />,
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
