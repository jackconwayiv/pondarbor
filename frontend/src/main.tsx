import { Auth0Provider } from "@auth0/auth0-react";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "./theme/system";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { AppSessionProvider } from "./auth/AppSessionProvider";
import { getPondarborPublicConfig } from "./auth/publicConfig";
import { safeAuthReturnTo } from "./auth/safeAuthReturnTo";
import "@fontsource/caprasimo/400.css";
import "@fontsource/pirata-one/400.css";
import "@fontsource/spinnaker/400.css";
import "./index.css";
import RootErrorBoundary from "./RootErrorBoundary";
import { router } from "./router";
import { installResumeRepaintNudge } from "./resumeRepaint";

void import("./instrument");

installResumeRepaintNudge();

const publicConfig = getPondarborPublicConfig();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Auth0Provider
      domain={publicConfig.auth0Domain}
      clientId={publicConfig.auth0ClientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: publicConfig.auth0ApiAudience ?? undefined,
        // Required for OIDC: without `openid`, sessions after redirect are incomplete.
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
        <RootErrorBoundary>
          <AppSessionProvider>
            <RouterProvider router={router} />
          </AppSessionProvider>
        </RootErrorBoundary>
      </ChakraProvider>
    </Auth0Provider>
  </StrictMode>,
);
