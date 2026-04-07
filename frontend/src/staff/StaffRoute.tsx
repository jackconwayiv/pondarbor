import { Link as ChakraLink, Stack, Text } from "@chakra-ui/react";
import { useEffect } from "react";
import { Link as RouterLink, Navigate, useNavigate } from "react-router";
import { useAppSession } from "../auth/AppSessionContext";
import { fullBleedStackProps } from "../responsive";
import StaffPage from "./StaffPage";

const STAFF_DENIED_REDIRECT_MS = 1000;

/** Shell message on `/staff`, then replace navigation to home (plus immediate “Go home” link). */
function StaffAccessDeniedShell() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = window.setTimeout(() => navigate("/", { replace: true }), STAFF_DENIED_REDIRECT_MS);
    return () => window.clearTimeout(t);
  }, [navigate]);

  return (
    <Stack flex="1" minH="full" gap="4" px={{ base: "4", md: "6" }} py={{ base: "6", md: "8" }} {...fullBleedStackProps}>
      <Text fontSize={{ base: "sm", md: "md" }}>Staff access required.</Text>
      <Text fontSize="sm" color="fg.muted">
        Redirecting you home in one second.
      </Text>
      <ChakraLink asChild fontSize="sm" textDecoration="underline" color="fg">
        <RouterLink to="/" replace>
          Go home now
        </RouterLink>
      </ChakraLink>
    </Stack>
  );
}

/** Staff see StaffPage; authenticated non-staff see the denied shell then redirect. */
export default function StaffRoute() {
  const { isAuthenticated, isLoading, sessionUser, error: sessionError } = useAppSession();

  if (isLoading) {
    return (
      <Stack flex="1" minH="full" gap="4" px={{ base: "4", md: "6" }} py={{ base: "6", md: "8" }} {...fullBleedStackProps}>
        <Text fontSize={{ base: "sm", md: "md" }}>Loading…</Text>
      </Stack>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (!sessionUser) {
    return (
      <Stack flex="1" minH="full" gap="4" px={{ base: "4", md: "6" }} py={{ base: "6", md: "8" }} {...fullBleedStackProps}>
        <Text fontSize={{ base: "sm", md: "md" }} color="fg">
          {sessionError ?? "Could not load your account session. Try signing in again."}
        </Text>
      </Stack>
    );
  }

  if (!sessionUser.user.is_staff) {
    return <StaffAccessDeniedShell />;
  }

  return <StaffPage />;
}
