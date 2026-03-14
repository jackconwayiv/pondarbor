import { Auth0Provider } from "@auth0/auth0-react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { AppSessionProvider } from "./auth/AppSessionProvider";
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
    >
      <ChakraProvider value={defaultSystem}>
        <AppSessionProvider>
          <RouterProvider router={router} />
        </AppSessionProvider>
      </ChakraProvider>
    </Auth0Provider>
  </StrictMode>,
);
