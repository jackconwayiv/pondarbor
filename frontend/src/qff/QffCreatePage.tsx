import {
  Box,
  Field,
  Flex,
  Heading,
  Input,
  SimpleGrid,
  Stack,
  Text,
  TooltipContent,
  TooltipPositioner,
  TooltipRoot,
  TooltipTrigger,
  VStack,
} from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";

import { useAppSession, type SessionUser } from "../auth/AppSessionContext";
import { PanelBlockSkeleton } from "../components/panelStatus";
import QffButton from "./QffButton";
import { createQffCharacter, fetchQffSession } from "./api";
import {
  GLYPH_DISPLAY,
  GLYPH_IDS,
  type GlyphId,
} from "./glyphCreation";

const NAME_RE = /^[a-zA-Z0-9 ]{1,20}$/;

const tooltipSurface = {
  bg: "#1a2218",
  color: "#c8e6a8",
  borderWidth: "1px",
  borderColor: "#3a4a3a",
  maxW: "min(320px, 85vw)",
  px: "2.5",
  py: "2",
  fontSize: "sm",
  lineHeight: "short",
} as const;

const tooltipRootProps = {
  closeDelay: 100,
  closeOnScroll: true,
  closeOnPointerDown: true,
  closeOnClick: true,
  closeOnEscape: true,
  interactive: false,
} as const;

/** Match server `validate_character_name`: letters, digits, spaces, max 20. */
function defaultCharacterNameFromSession(sessionUser: SessionUser): string {
  const raw = (sessionUser.profile.display_name || "").trim();
  const fromDisplay = raw
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20);
  if (fromDisplay) return fromDisplay;
  const emailLocal = (sessionUser.user.email || "").split("@")[0] || "";
  const fromEmail = emailLocal
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 20);
  if (fromEmail) return fromEmail;
  return "Hero";
}

function GlyphTile({
  gid,
  selected,
  onSelect,
}: {
  gid: GlyphId;
  selected: GlyphId | null;
  onSelect: (g: GlyphId) => void;
}) {
  const d = GLYPH_DISPLAY[gid];
  const isSel = selected === gid;
  const detailByGlyph: Record<GlyphId, string> = {
    "⚔️": "A fighter of alien invaders and rebellious robots.",
    "🔑": "A rogue with stealthy skills to fend for yourself.",
    "📖": "A scholar of lost knowledge and magical power.",
    "❤️‍🩹": "A caretaker, steward, and fixer of the broken world.",
  };
  const labelByGlyph: Record<GlyphId, string> = {
    "⚔️": "BRAWLER",
    "🔑": "SCAVENGER",
    "📖": "OCCULTIST",
    "❤️‍🩹": "MENDER",
  };
  return (
    <TooltipRoot {...tooltipRootProps}>
      <TooltipTrigger asChild>
        <QffButton
          type="button"
          onClick={() => onSelect(gid)}
          display="flex"
          flexDirection="row"
          alignItems="center"
          justifyContent="flex-start"
          gap={4}
          minH={{ base: "84px", md: "94px" }}
          h="auto"
          py={3}
          px={4}
          w="100%"
          bg={isSel ? "#2a3a2a" : "#141414"}
          borderWidth="2px"
          borderColor={isSel ? "#7cb342" : "#3a4a3a"}
          color="#c8e6a8"
          whiteSpace="normal"
        >
          <Text fontSize="2xl" lineHeight="1" aria-hidden flexShrink={0}>
            {d.emoji}
          </Text>
          <Stack gap={0.5} align="flex-start" minW={0}>
            <Text fontSize="xs" fontWeight="semibold" letterSpacing="wide" textAlign="left">
              {labelByGlyph[gid]}
            </Text>
            <Text fontSize="sm" color="#a8b898" textAlign="left" whiteSpace="normal">
              {detailByGlyph[gid]}
            </Text>
          </Stack>
        </QffButton>
      </TooltipTrigger>
      <TooltipPositioner>
        <TooltipContent {...tooltipSurface}>{d.tooltip}</TooltipContent>
      </TooltipPositioner>
    </TooltipRoot>
  );
}

export default function QffCreatePage() {
  const navigate = useNavigate();
  const { isAuthenticated, sessionUser, isLoading, getApiAccessToken } = useAppSession();
  const getTokenRef = useRef(getApiAccessToken);
  getTokenRef.current = getApiAccessToken;
  const [loading, setLoading] = useState(true);
  const [glyph1, setGlyph1] = useState<GlyphId | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [redirectPlay, setRedirectPlay] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !sessionUser?.user?.is_approved) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await getTokenRef.current();
        const s = await fetchQffSession(token);
        if (cancelled) return;
        if (s.has_character) {
          setRedirectPlay(true);
          return;
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, sessionUser?.user?.is_approved]);

  useEffect(() => {
    if (!sessionUser) return;
    setName((prev) =>
      prev.trim() === "" ? defaultCharacterNameFromSession(sessionUser) : prev,
    );
  }, [sessionUser]);

  const submit = useCallback(async () => {
    if (glyph1 == null) return;
    setError(null);
    const trimmed = name.trim();
    if (!NAME_RE.test(trimmed)) {
      setError("Name: max 20 characters, letters, digits, and spaces only.");
      return;
    }
    setSaving(true);
    try {
      const token = await getTokenRef.current();
      await createQffCharacter(token, {
        name: trimmed,
        glyphs: [glyph1],
      });
      navigate("/qff/play");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed.");
    } finally {
      setSaving(false);
    }
  }, [name, glyph1, navigate]);

  if (!isAuthenticated) {
    return (
      <Box px={4} py={8}>
        <Text>Sign in to create a character.</Text>
      </Box>
    );
  }

  if (redirectPlay) {
    return <Navigate to="/qff/play" replace />;
  }

  if (isLoading || loading) {
    return (
      <Box px={4} py={8} maxW="md">
        <PanelBlockSkeleton lines={2} showTitleLine />
      </Box>
    );
  }

  if (!sessionUser?.user?.is_approved) {
    return (
      <Box px={4} py={8}>
        <Text>Approval required.</Text>
      </Box>
    );
  }

  return (
    <Box w="100%" maxW="5xl" minW={0} mx="auto" px={4} py={8}>
      <Heading size="md" mb={6} color="#e8f5c8">
        Create your Hero of Fat
      </Heading>

      <VStack gap={6} align="stretch" w="100%" minW={0}>
        <Text color="#c8e6a8" lineHeight="tall">
          In the wake of the five catastrophes, you have gotten by mainly by becoming….
        </Text>

        <SimpleGrid columns={{ base: 1, md: 2 }} gap={3}>
          {GLYPH_IDS.map((gid) => (
            <GlyphTile key={gid} gid={gid} selected={glyph1} onSelect={setGlyph1} />
          ))}
        </SimpleGrid>

        <Flex
          gap={3}
          align={{ base: "stretch", md: "center" }}
          direction={{ base: "column", md: "row" }}
        >
          <Field.Root flex="1">
            <Field.Label>Character name</Field.Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              bg="#141414"
              borderColor="#3a4a3a"
              color="#c8e6a8"
            />
            <Field.HelperText color="#9e9e9e">
              Max 20 characters. Letters, digits, and spaces only.
            </Field.HelperText>
          </Field.Root>
          <Flex gap={3} flexWrap="wrap" align="center">
            <QffButton type="button" onClick={submit} disabled={saving || glyph1 == null}>
              {saving ? "Creating…" : "Let’s Do This"}
            </QffButton>
            <QffButton type="button" onClick={() => navigate("/qff")} disabled={saving}>
              Return to Lobby
            </QffButton>
          </Flex>
        </Flex>

        {error && (
          <Text color="nautical.solid" fontSize="sm" role="alert">
            {error}
          </Text>
        )}

      </VStack>
    </Box>
  );
}
