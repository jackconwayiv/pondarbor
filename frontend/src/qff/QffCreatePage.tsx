import {
  Box,
  Field,
  Flex,
  Heading,
  Input,
  SimpleGrid,
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
import QffButton from "./QffButton";
import { createQffCharacter, fetchQffSession } from "./api";
import {
  CLASS_SUMMARY_BY_SLUG,
  GLYPH_DISPLAY,
  GLYPH_IDS,
  classSlugForGlyphs,
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
  step,
  selected,
  onSelect,
}: {
  gid: GlyphId;
  step: 1 | 2;
  selected: GlyphId | null;
  onSelect: (g: GlyphId) => void;
}) {
  const d = GLYPH_DISPLAY[gid];
  const label = step === 1 ? d.step1Label : d.step2Label;
  const isSel = selected === gid;
  return (
    <TooltipRoot {...tooltipRootProps}>
      <TooltipTrigger asChild>
        <QffButton
          type="button"
          onClick={() => onSelect(gid)}
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          gap={2}
          minH={{ base: "120px", md: "140px" }}
          h="auto"
          py={4}
          px={3}
          w="100%"
          bg={isSel ? "#2a3a2a" : "#141414"}
          borderWidth="2px"
          borderColor={isSel ? "#7cb342" : "#3a4a3a"}
          color="#c8e6a8"
          whiteSpace="normal"
        >
          <Text fontSize="4xl" lineHeight="1" aria-hidden>
            {d.emoji}
          </Text>
          <Text fontSize="md" fontWeight="semibold" letterSpacing="wide">
            {label}
          </Text>
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
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [glyph1, setGlyph1] = useState<GlyphId | null>(null);
  const [glyph2, setGlyph2] = useState<GlyphId | null>(null);
  const [pick, setPick] = useState<GlyphId | null>(null);
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

  const resetWizard = useCallback(() => {
    setStep(1);
    setGlyph1(null);
    setGlyph2(null);
    setPick(null);
    setError(null);
  }, []);

  const confirmStep = useCallback(() => {
    if (pick == null) return;
    if (step === 1) {
      setGlyph1(pick);
      setPick(null);
      setStep(2);
      return;
    }
    if (step === 2) {
      setGlyph2(pick);
      setPick(null);
      setStep(3);
    }
  }, [pick, step]);

  const submit = useCallback(async () => {
    if (glyph1 == null || glyph2 == null) return;
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
        glyphs: [glyph1, glyph2],
      });
      navigate("/qff/play");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed.");
    } finally {
      setSaving(false);
    }
  }, [name, glyph1, glyph2, navigate]);

  const summarySlug =
    glyph1 != null && glyph2 != null ? classSlugForGlyphs(glyph1, glyph2) : undefined;
  const summary = summarySlug ? CLASS_SUMMARY_BY_SLUG[summarySlug] : undefined;

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
      <Box px={4} py={8}>
        <Text>Loading…</Text>
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
    <Box w="100%" maxW="lg" minW={0} mx="auto" px={4} py={8}>
      <Heading size="md" mb={6} color="#e8f5c8">
        Create your Hero of Fat
      </Heading>

      {step <= 2 && (
        <VStack gap={6} align="stretch" w="100%" minW={0}>
          <Text color="#c8e6a8" lineHeight="tall">
            {step === 1
              ? "Your childhood was shaped by…"
              : "Before setting out on adventure, you spent time focused on…"}
          </Text>

          <SimpleGrid columns={2} gap={4} w="100%">
            {GLYPH_IDS.map((gid) => (
              <GlyphTile
                key={gid}
                gid={gid}
                step={step === 2 ? 2 : 1}
                selected={pick}
                onSelect={setPick}
              />
            ))}
          </SimpleGrid>

          {error && (
            <Text color="nautical.solid" fontSize="sm" role="alert">
              {error}
            </Text>
          )}

          <Flex gap={3} flexWrap="wrap" align="center">
            <QffButton type="button" onClick={confirmStep} disabled={pick == null}>
              CONFIRM
            </QffButton>
            {step === 1 && (
              <QffButton type="button" onClick={() => navigate("/qff")}>
                Back
              </QffButton>
            )}
            {step === 2 && (
              <QffButton
                type="button"
                onClick={() => {
                  setStep(1);
                  setGlyph1(null);
                  setPick(null);
                  setError(null);
                }}
              >
                Back
              </QffButton>
            )}
          </Flex>
        </VStack>
      )}

      {step === 3 && glyph1 != null && glyph2 != null && summary && (
        <VStack gap={6} align="stretch" w="100%" minW={0}>
          <Text color="#a8d080" fontSize="sm" fontWeight="medium" letterSpacing="wide">
            {GLYPH_DISPLAY[glyph1].emoji} {GLYPH_DISPLAY[glyph1].step1Label} →{" "}
            {GLYPH_DISPLAY[glyph2].emoji} {GLYPH_DISPLAY[glyph2].step2Label}
          </Text>
          <Box>
            <Text color="#e8f5c8" fontSize="lg" fontWeight="semibold" mb={2}>
              You are a {summary.name}.
            </Text>
            <Text color="#a3a3a3" fontSize="sm" lineHeight="tall" whiteSpace="pre-wrap">
              {summary.description}
            </Text>
          </Box>

          <Field.Root>
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

          {error && (
            <Text color="nautical.solid" fontSize="sm" role="alert">
              {error}
            </Text>
          )}

          <Flex gap={3} flexWrap="wrap" align="center">
            <QffButton type="button" onClick={submit} disabled={saving}>
              {saving ? "Creating…" : "Let’s Do This"}
            </QffButton>
            <QffButton type="button" onClick={resetWizard} disabled={saving}>
              That’s Not Me
            </QffButton>
          </Flex>
        </VStack>
      )}
    </Box>
  );
}
