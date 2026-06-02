import { Box, HStack, Stack, Text, Textarea } from "@chakra-ui/react";
import { useMemo, useState } from "react";
import PondButton from "../PondButton";
import PondNativeSelect from "../components/PondNativeSelect";
import { APP_TEXT_SIZES, PANEL_FIELD_PROPS } from "../theme/typography";
import { importPantryText, parsePantryText } from "./api";
import type { ParsedPantryItem } from "./types";

type PantryBulkImportPanelProps = {
  getApiAccessToken: () => Promise<string | null>;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onImported: () => Promise<void>;
};

export function PantryBulkImportPanel({
  getApiAccessToken,
  busy,
  setBusy,
  onImported,
}: PantryBulkImportPanelProps) {
  const [text, setText] = useState("");
  const [merge, setMerge] = useState<"set" | "add">("set");
  const [preview, setPreview] = useState<ParsedPantryItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const importable = useMemo(
    () => (preview ?? []).filter((it) => !it.skipped && !it.is_section_header && it.name),
    [preview],
  );
  const showLocation = useMemo(
    () => importable.some((it) => it.location.trim() !== ""),
    [importable],
  );

  return (
    <Stack gap="2">
      <Text fontSize={APP_TEXT_SIZES.meta} color="fg.muted">
        Paste one item per line. Optional section headers (e.g. CHEST FREEZER) set location for
        following rows.
      </Text>
      <Textarea
        fontFamily="mono"
        fontSize="sm"
        rows={12}
        placeholder={"2 lb shrimp\n1 open bag of okra\nCHEST FREEZER\n1 bag sweet corn"}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPreview(null);
          setErr(null);
        }}
        {...PANEL_FIELD_PROPS}
      />
      <HStack gap="2" flexWrap="wrap" align="flex-end">
        <PondButton
          size="sm"
          colorPalette="sky"
          loading={busy}
          disabled={!text.trim()}
          onClick={() => {
            void (async () => {
              setBusy(true);
              setErr(null);
              try {
                const tok = await getApiAccessToken();
                const r = await parsePantryText(tok, text);
                setPreview(r.items);
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Parse failed");
                setPreview(null);
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          Parse preview
        </PondButton>
        <PondNativeSelect
          rootProps={{ size: "sm", minW: "10rem" }}
          fieldProps={{
            value: merge,
            onChange: (e) => setMerge(e.target.value as "set" | "add"),
          }}
        >
          <option value="set">Set counts</option>
          <option value="add">Add to existing</option>
        </PondNativeSelect>
        <PondButton
          size="sm"
          colorPalette="lilypad"
          loading={busy}
          disabled={importable.length === 0}
          onClick={() => {
            void (async () => {
              setBusy(true);
              setErr(null);
              try {
                const tok = await getApiAccessToken();
                await importPantryText(tok, { text, merge });
                setText("");
                setPreview(null);
                await onImported();
              } catch (e) {
                setErr(e instanceof Error ? e.message : "Import failed");
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          Import {importable.length > 0 ? importable.length : ""} items
        </PondButton>
      </HStack>
      {err ? (
        <Text fontSize={APP_TEXT_SIZES.meta} color="nautical.solid" role="alert">
          {err}
        </Text>
      ) : null}
      {preview && preview.length > 0 ? (
        <Box overflowX="auto" borderWidth="1px" borderColor="border.muted" borderRadius="md">
          <Stack gap="0" fontSize={APP_TEXT_SIZES.helper}>
            <HStack
              gap="2"
              px="2"
              py="1"
              bg="bg.subtle"
              fontWeight="semibold"
              borderBottomWidth="1px"
              borderColor="border.muted"
            >
              {showLocation ? <Text minW="6rem">Location</Text> : null}
              <Text minW="8rem">Ingredient</Text>
              <Text minW="3rem">Qty</Text>
              <Text flex="1">Original line</Text>
            </HStack>
            {preview.map((it, idx) =>
              it.is_section_header ? (
                <Box
                  key={`header-${idx}`}
                  px="2"
                  py="1"
                  bg="bg.muted"
                  borderBottomWidth="1px"
                  borderColor="border.muted"
                >
                  <Text fontWeight="semibold">{it.location || it.raw_line}</Text>
                </Box>
              ) : it.skipped ? null : (
                <HStack
                  key={`row-${idx}`}
                  gap="2"
                  px="2"
                  py="1"
                  borderBottomWidth="1px"
                  borderColor="border.muted"
                  align="flex-start"
                >
                  {showLocation ? (
                    <Text minW="6rem" color="fg.muted">
                      {it.location || "—"}
                    </Text>
                  ) : null}
                  <Text minW="8rem" fontWeight="medium">
                    {it.name}
                  </Text>
                  <Text minW="3rem">{it.quantity}</Text>
                  <Text flex="1" color="fg.muted">
                    {it.raw_line}
                  </Text>
                </HStack>
              ),
            )}
          </Stack>
        </Box>
      ) : preview ? (
        <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
          No importable lines found.
        </Text>
      ) : null}
    </Stack>
  );
}
