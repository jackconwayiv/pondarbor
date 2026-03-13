import UserDetailPage from "./UserDetailPage";
import UsersHomePage from "./UsersHomePage";

export const usersRoutes = [
  {
    path: "users",
    children: [
      {
        index: true,
        element: <UsersHomePage />,
      },
      {
        path: ":userId",
        element: <UserDetailPage />,
      },
    ],
  },
];
