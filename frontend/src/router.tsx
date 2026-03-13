import { createBrowserRouter } from "react-router";
import HomePage from "./HomePage";
import AppLayout from "./layout";
import NotFoundPage from "./NotFoundPage";
import { usersRoutes } from "./routes";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      ...usersRoutes,
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
