import {
  Box,
  Field,
  Flex,
  Heading,
  Input,
  NativeSelectField,
  NativeSelectRoot,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router";

import { useAppSession, type SessionUser } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { createQffCharacter, fetchQffSession, type QffSessionNoCharacter } from "./api";

const NAME_RE = /^[a-zA-Z0-9 ]{1,20}$/;

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

function classBlurb(
  slug: string,
  classes: QffSessionNoCharacter["character_classes"],
): string {
  const row = classes.find((c) => c.slug === slug);
  return (row?.description ?? "").trim();
}

export default function QffCreatePage() {
  const navigate = useNavigate();
  const { isAuthenticated, sessionUser, isLoading, getApiAccessToken } = useAppSession();
  const getTokenRef = useRef(getApiAccessToken);
  getTokenRef.current = getApiAccessToken;
  const [classes, setClasses] = useState<QffSessionNoCharacter["character_classes"]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [cls, setCls] = useState("nurse");
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
        setClasses(s.character_classes);
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
        character_class: cls,
      });
      navigate("/qff/play");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed.");
    } finally {
      setSaving(false);
    }
  }, [name, cls, navigate]);

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
      <VStack gap={6} align="stretch" w="100%" minW={0}>
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

        <Field.Root>
          <Stack gap={2} align="stretch" w="100%" minW={0}>
            <Field.Label>Class</Field.Label>
            <NativeSelectRoot size="md" width="100%">
              <NativeSelectField
                value={cls}
                onChange={(e) => setCls(e.target.value)}
                bg="#141414"
                borderColor="#3a4a3a"
                color="#c8e6a8"
                w="100%"
              >
                {classes.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </NativeSelectField>
            </NativeSelectRoot>
            {classBlurb(cls, classes) ? (
              <Text
                fontSize="sm"
                lineHeight="short"
                w="100%"
                maxW="100%"
                wordBreak="break-word"
                css={{ color: "#a3a3a3 !important" }}
              >
                {classBlurb(cls, classes)}
              </Text>
            ) : null}
          </Stack>
        </Field.Root>

        {error && (
          <Text color="nautical.solid" fontSize="sm" role="alert">
            {error}
          </Text>
        )}

        <Flex gap={3}>
          <PondButton type="button" onClick={submit} disabled={saving}>
            {saving ? "Creating…" : "Begin"}
          </PondButton>
          <PondButton type="button" onClick={() => navigate("/qff")}>
            Back
          </PondButton>
        </Flex>
      </VStack>
    </Box>
  );
}
