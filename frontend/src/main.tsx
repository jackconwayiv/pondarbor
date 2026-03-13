import { Auth0Provider } from "@auth0/auth0-react";
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import "./index.css";
import { router } from "./router";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* <Auth0Provider
      domain="dev-val01p2eow801kgu.us.auth0.com"
      clientId="0Ua0O4s3VCyFkf5uHGv7QR4CKp10Kzc9"
      authorizationParams={{ redirect_uri: window.location.origin }}
    > */}
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
        <RouterProvider router={router} />
      </ChakraProvider>
    </Auth0Provider>
  </StrictMode>,
);
