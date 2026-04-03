import { Auth0Provider } from "@auth0/auth0-react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "./theme/system";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { AchievementUnlockListener } from "./achievements/AchievementUnlockListener";
import { AchievementToaster } from "./achievements/achievementToaster";
import { AppSessionProvider } from "./auth/AppSessionProvider";
import { safeAuthReturnTo } from "./auth/safeAuthReturnTo";
import "./index.css";
import { router } from "./router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Auth0Provider
      domain={import.meta.env.VITE_AUTH0_DOMAIN!}
      clientId={import.meta.env.VITE_AUTH0_CLIENT_ID!}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: import.meta.env.VITE_AUTH0_API_AUDIENCE,
        scope: "openid profile email",
      }}
      cacheLocation="localstorage"
      onRedirectCallback={(appState) => {
        const raw = appState?.returnTo;
        const path =
          typeof raw === "string" ? safeAuthReturnTo(raw) : null;
        const dest = path ?? window.location.pathname;
        void router.navigate(dest, { replace: true });
      }}
    >
      <ChakraProvider value={system}>
        <AppSessionProvider>
          <AchievementUnlockListener />
          <AchievementToaster />
          <RouterProvider router={router} />
        </AppSessionProvider>
      </ChakraProvider>
    </Auth0Provider>
  </StrictMode>,
);
