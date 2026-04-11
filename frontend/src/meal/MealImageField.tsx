import { Box, Button, HStack, Image, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { useCallback, useRef, useState } from "react";
import { fetchMyImageInventory } from "../closet/api";
import type { ClosetImageInventoryRow } from "../closet/types";
import PondButton from "../PondButton";
import { AppModal } from "../components/AppModal";
import { APP_TEXT_SIZES } from "../theme/typography";
import { publicUrlForR2ImageKey } from "./imagePublicUrl";
import { uploadMealImageViaPresign } from "./mealImageUpload";

export type MealImageFieldProps = {
  imageKey: string;
  /** Shown when set (e.g. from API `image_url`); falls back to public URL from `imageKey`. */
  imageUrl?: string;
  onImageKeyChange: (key: string) => void;
  getApiAccessToken: () => Promise<string>;
  disabled?: boolean;
};

export function MealImageField({
  imageKey,
  imageUrl,
  onImageKeyChange,
  getApiAccessToken,
  disabled = false,
}: MealImageFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [inventoryRows, setInventoryRows] = useState<ClosetImageInventoryRow[]>([]);
  const [inventoryErr, setInventoryErr] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [pickerBusy, setPickerBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const preview =
    (imageUrl ?? "").trim() ||
    (imageKey.trim() ? publicUrlForR2ImageKey(imageKey) : "");

  const loadInventory = useCallback(async () => {
    setPickerBusy(true);
    setInventoryErr(null);
    try {
      const t = await getApiAccessToken();
      const payload = await fetchMyImageInventory(t);
      const rows = payload.results.filter((r) => (r.image_url ?? "").trim().length > 0);
      setInventoryRows(rows);
    } catch (e) {
      setInventoryErr(e instanceof Error ? e.message : "Could not load images");
      setInventoryRows([]);
    } finally {
      setPickerBusy(false);
    }
  }, [getApiAccessToken]);

  const openPicker = useCallback(() => {
    setPickerOpen(true);
    void loadInventory();
  }, [loadInventory]);

  return (
    <Stack gap="2" w="100%">
      <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
        Recipe photo (optional)
      </Text>
      <HStack gap="3" flexWrap="wrap" align="flex-start">
        <Box
          w="100%"
          maxW="12rem"
          aspectRatio={4 / 3}
          borderRadius="md"
          borderWidth="1px"
          borderColor="border"
          bg="bg.subtle"
          overflow="hidden"
          flexShrink={0}
        >
          {preview ? (
            <Image src={preview} alt="" w="100%" h="100%" objectFit="cover" />
          ) : (
            <Box w="100%" h="100%" minH="6rem" />
          )}
        </Box>
        <Stack gap="2" align="flex-start">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            disabled={disabled || uploadBusy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              void (async () => {
                setUploadBusy(true);
                try {
                  const key = await uploadMealImageViaPresign(getApiAccessToken, file);
                  onImageKeyChange(key);
                } finally {
                  setUploadBusy(false);
                }
              })();
            }}
          />
          <HStack gap="2" flexWrap="wrap">
            <PondButton
              size="sm"
              colorPalette="sky"
              variant="outline"
              loading={uploadBusy}
              disabled={disabled || uploadBusy}
              onClick={() => fileRef.current?.click()}
            >
              Upload
            </PondButton>
            <PondButton
              size="sm"
              colorPalette="sky"
              variant="outline"
              disabled={disabled || uploadBusy}
              onClick={openPicker}
            >
              Choose from My Images
            </PondButton>
            {imageKey.trim() ? (
              <PondButton
                size="sm"
                colorPalette="nautical"
                variant="outline"
                disabled={disabled || uploadBusy}
                onClick={() => onImageKeyChange("")}
              >
                Remove
              </PondButton>
            ) : null}
          </HStack>
        </Stack>
      </HStack>

      <AppModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Choose an image"
        size="lg"
        description="Photos from your Closet uploads and recipe uploads."
      >
        {pickerBusy ? (
          <Text fontSize={APP_TEXT_SIZES.helper}>Loading…</Text>
        ) : inventoryErr ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="nautical.solid" role="alert">
            {inventoryErr}
          </Text>
        ) : inventoryRows.length === 0 ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
            No images yet. Upload a photo or add one from Closet first.
          </Text>
        ) : (
          <SimpleGrid columns={{ base: 2, md: 3 }} gap="3" maxH="50vh" overflowY="auto">
            {inventoryRows.map((row) => (
              <Button
                key={row.image_key}
                type="button"
                variant="ghost"
                h="auto"
                p="0"
                borderWidth="1px"
                borderColor="border"
                borderRadius="md"
                overflow="hidden"
                onClick={() => {
                  onImageKeyChange(row.image_key);
                  setPickerOpen(false);
                }}
                _hover={{ borderColor: "lilypad.solid" }}
              >
                <Image
                  src={row.image_url}
                  alt=""
                  w="100%"
                  aspectRatio={4 / 3}
                  objectFit="cover"
                />
              </Button>
            ))}
          </SimpleGrid>
        )}
      </AppModal>
    </Stack>
  );
}
