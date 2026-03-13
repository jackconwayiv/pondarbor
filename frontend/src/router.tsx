import { createBrowserRouter } from "react-router";
import App from "./App";
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
        element: <App />,
      },
      ...usersRoutes,
      {
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
