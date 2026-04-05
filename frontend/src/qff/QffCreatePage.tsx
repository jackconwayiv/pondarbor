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

import { useAppSession } from "../auth/AppSessionContext";
import PondButton from "../PondButton";
import { createQffCharacter, fetchQffSession, type QffSessionNoCharacter } from "./api";

const NAME_RE = /^[a-zA-Z0-9 ]{1,20}$/;

/** One-line flavor text for create UI; keys match CharacterClass.slug from the API. */
const CLASS_DESCRIPTION: Record<string, string> = {
  nurse:
    "Trained to patch wounds, read vitals, and win fights with patience and a very heavy clipboard.",
  gym_rat:
    "Lives for the grind, protein math, and turning every encounter into leg day.",
};

function classBlurb(slug: string): string {
  return CLASS_DESCRIPTION[slug.trim().toLowerCase()] ?? "";
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
    <Box maxW="lg" mx="auto" px={4} py={8}>
      <Heading size="md" mb={6} color="#e8f5c8">
        Create your Hero of Fat
      </Heading>
      <VStack gap={6} align="stretch">
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
          <Stack gap={2} align="stretch" w="100%">
            <Field.Label>Class</Field.Label>
            <NativeSelectRoot size="md" width="100%">
              <NativeSelectField
                value={cls}
                onChange={(e) => setCls(e.target.value)}
                bg="#141414"
                borderColor="#3a4a3a"
                color="#c8e6a8"
              >
                {classes.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </NativeSelectField>
            </NativeSelectRoot>
            {classBlurb(cls) ? (
              <Text
                fontSize="sm"
                lineHeight="short"
                css={{ color: "#a3a3a3 !important" }}
              >
                {classBlurb(cls)}
              </Text>
            ) : null}
          </Stack>
        </Field.Root>

        {error && (
          <Text color="#f6a060" fontSize="sm">
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
