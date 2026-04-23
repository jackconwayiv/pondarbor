import {
  Box,
  Button,
  HStack,
  PopoverBody,
  PopoverContent,
  PopoverPositioner,
  PopoverRoot,
  PopoverTrigger,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useState } from "react";
import { FaBell } from "react-icons/fa";
import { useNavigate } from "react-router";

import { NAV_HEADER_LINK_TEXT } from "../appNavConfig";
import { useAppSession } from "../auth/AppSessionContext";
import { useHomeInbox } from "../home/homeInboxContext";
import PondButton from "../PondButton";
import { APP_TEXT_SIZES } from "../theme/typography";

function HomeNoticeCard({ text }: { text: string }) {
  return (
    <Box
      bg="lilypad.solid"
      color="lilypad.contrast"
      borderRadius="xl"
      px={{ base: 2, md: 2 }}
      py={{ base: 2, md: 2 }}
      fontWeight="bold"
      textStyle={{ base: "sm", md: "md" }}
      lineHeight="short"
      maxW={{ base: "100%", md: "22rem" }}
    >
      {text}
    </Box>
  );
}

const popoverContentSx = {
  w: { base: "min(100vw - 1rem, 22rem)", md: "24rem" },
  maxH: "70vh",
  overflowY: "auto" as const,
  bg: "bg",
  color: "fg",
  borderWidth: "1px",
  borderColor: "border",
  boxShadow: "md",
  borderRadius: "md",
};

export function HomeInboxPopover() {
  const { sessionUser, auth0User } = useAppSession();
  const {
    homePrompts,
    homeNoticeItems,
    inboxStatus,
    inboxError,
    inboxInitialSyncComplete,
    unreadCount,
    refreshInbox,
    markInboxViewed,
  } = useHomeInbox();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!auth0User || !sessionUser) {
    return null;
  }

  const totalInboxItems = homePrompts.length + homeNoticeItems.length;
  /** No rows to show, after at least one sync — hide bell (chicken/egg: need fetch before we know counts). */
  const hideBellEntirely =
    inboxInitialSyncComplete &&
    inboxStatus === "idle" &&
    !inboxError &&
    totalInboxItems === 0;
  if (hideBellEntirely) {
    return null;
  }

  const nickname =
    sessionUser?.profile?.display_name ??
    auth0User.nickname ??
    auth0User.name ??
    "friend";

  return (
    <PopoverRoot
      open={open}
      onOpenChange={async (e) => {
        setOpen(e.open);
        if (e.open) {
          const ids = await refreshInbox();
          if (ids !== null) {
            markInboxViewed(ids);
          }
        }
      }}
      positioning={{ placement: "bottom-end", gutter: 8 }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={
            unreadCount > 0
              ? `Activity, ${unreadCount} unread`
              : "Activity"
          }
          position="relative"
          bg="transparent"
          color={NAV_HEADER_LINK_TEXT.inactive}
          _hover={{
            bg: "transparent",
            color: "white",
          }}
          _active={{ bg: "transparent", color: "white" }}
          _focus={{ boxShadow: "none" }}
          _focusVisible={{ boxShadow: "none", outline: "2px solid", outlineColor: "white", outlineOffset: "2px" }}
          px="2"
          minW="auto"
          h="auto"
          lineHeight="1"
        >
          <Box as="span" display="block" lineHeight="1" aria-hidden>
            <FaBell size={16} style={{ display: "block" }} />
          </Box>
          {unreadCount > 0 ? (
            <Box
              as="span"
              position="absolute"
              top="-1px"
              right="-1px"
              minW="1rem"
              h="1rem"
              px="1"
              display="inline-flex"
              alignItems="center"
              justifyContent="center"
              borderRadius="full"
              bg="orange.solid"
              color="white"
              fontSize="0.6rem"
              fontWeight="bold"
              lineHeight="1"
              borderWidth="1px"
              borderColor="navy.solid"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Box>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverPositioner>
        <PopoverContent bg="bg" color="fg" boxShadow="lg" border="none" p="0" maxW="unset">
          <PopoverBody p="0" bg="transparent">
            <Box {...popoverContentSx}>
              <Stack gap="3" p="3" align="stretch">
                <Stack gap="1">
                  <Text
                    fontWeight="bold"
                    fontSize="sm"
                    textTransform="uppercase"
                    letterSpacing="wider"
                    color="fg.muted"
                  >
                    Activity
                  </Text>
                  <Text fontSize={APP_TEXT_SIZES.body} color="fg">
                    Welcome, {nickname}!
                  </Text>
                </Stack>

                {inboxError ? (
                  <Text color="orange.solid" fontSize="sm" fontWeight="medium">
                    {inboxError}
                  </Text>
                ) : null}
                {inboxStatus === "loading" && !inboxError ? (
                  <Text fontSize="sm" color="fg.muted">
                    Loading…
                  </Text>
                ) : null}

                <>
                  {homePrompts.length > 0 ? (
                    <HStack
                      gap="2"
                      flexWrap="wrap"
                      align="stretch"
                      w="100%"
                      role="region"
                      aria-label="Prompts"
                    >
                      {homePrompts.map((prompt) => (
                        <PondButton
                          key={prompt.id}
                          type="button"
                          colorPalette="nautical"
                          fontWeight="bold"
                          whiteSpace="normal"
                          textAlign="center"
                          h="auto"
                          py={2}
                          px={2}
                          maxW="100%"
                          onClick={() => {
                            setOpen(false);
                            void navigate(prompt.to);
                          }}
                        >
                          {prompt.text}
                        </PondButton>
                      ))}
                    </HStack>
                  ) : null}
                  {homeNoticeItems.length > 0 ? (
                    <HStack
                      gap="2"
                      flexWrap="wrap"
                      align="stretch"
                      w="100%"
                      role="region"
                      aria-label="Notices"
                    >
                      {homeNoticeItems.map((item) => (
                        <HomeNoticeCard key={item.id} text={item.text} />
                      ))}
                    </HStack>
                  ) : null}
                </>
              </Stack>
            </Box>
          </PopoverBody>
        </PopoverContent>
      </PopoverPositioner>
    </PopoverRoot>
  );
}
