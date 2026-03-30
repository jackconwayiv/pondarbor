import { createBrowserRouter } from "react-router";
import App from "./App";
import AppLayout from "./layout";
import NotFoundPage from "./NotFoundPage";
import ProfilePage from "./ProfilePage";

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
        path: "*",
        element: <NotFoundPage />,
      },
    ],
  },
]);
