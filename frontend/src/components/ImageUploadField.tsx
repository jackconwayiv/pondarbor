import { Box, Button, HStack, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import PresignedImage from "../lib/PresignedImage";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { fetchMyImageInventory } from "../closet/api";
import type { ClosetImageInventoryRow } from "../closet/types";
import { useR2ImageUpload, type R2ImageUploadFromBlob } from "../lib/useR2ImageUpload";
import PondButton from "../PondButton";
import { AppModal } from "./AppModal";
import { UploadProgressBar } from "./UploadProgressBar";
import { APP_TEXT_SIZES } from "../theme/typography";

export type ImageUploadFieldProps = {
  label: ReactNode;
  imageKey: string;
  imageUrl?: string;
  onImageKeyChange: (key: string) => void;
  getApiAccessToken: () => Promise<string>;
  uploadFromBlob: R2ImageUploadFromBlob;
  disabled?: boolean;
  aspectRatio?: number;
  previewMaxW?: string;
  inventoryDescription?: string;
  myImagesLabel?: string;
  successMessage?: string;
  onUploadSuccess?: (key: string) => void;
  inventoryPickerAspectRatio?: number;
};

export function ImageUploadField({
  label,
  imageKey,
  imageUrl,
  onImageKeyChange,
  getApiAccessToken,
  uploadFromBlob,
  disabled = false,
  aspectRatio = 1,
  previewMaxW = "8rem",
  inventoryDescription = "Photos from your Closet uploads.",
  myImagesLabel = "My images",
  successMessage = "Photo uploaded",
  onUploadSuccess,
  inventoryPickerAspectRatio,
}: ImageUploadFieldProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [inventoryRows, setInventoryRows] = useState<ClosetImageInventoryRow[]>([]);
  const [inventoryErr, setInventoryErr] = useState<string | null>(null);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [pickedViewUrl, setPickedViewUrl] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const upload = useR2ImageUpload({
    getApiAccessToken,
    onKeyChange: onImageKeyChange,
    uploadFromBlob,
    successMessage,
    onUploadSuccess,
  });

  const remotePreview =
    (imageUrl ?? "").trim() ||
    (upload.uploadedViewUrl ?? "").trim() ||
    pickedViewUrl.trim();
  const preview = upload.localPreviewUrl || remotePreview || "";

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

  const pickerAspect = inventoryPickerAspectRatio ?? aspectRatio;
  const fieldDisabled = disabled || upload.busy;

  return (
    <Stack gap="2" w="100%">
      {typeof label === "string" ? (
        <Text fontSize={APP_TEXT_SIZES.label} fontWeight="medium" color="fg">
          {label}
        </Text>
      ) : (
        label
      )}
      <HStack gap="3" flexWrap="wrap" align="flex-start">
        <Box
          w="100%"
          maxW={previewMaxW}
          aspectRatio={aspectRatio}
          borderRadius={aspectRatio === 1 ? "lg" : "md"}
          borderWidth="1px"
          borderColor="border"
          bg={aspectRatio === 1 ? "gray.50" : "bg.subtle"}
          overflow="hidden"
          flexShrink={0}
        >
          {preview ? (
            upload.localPreviewUrl ? (
              <PresignedImage src={preview} alt="" w="100%" h="100%" objectFit="cover" />
            ) : (
              <PresignedImage
                src={preview}
                imageKey={imageKey.trim() || undefined}
                getApiAccessToken={getApiAccessToken}
                alt=""
                w="100%"
                h="100%"
                objectFit="cover"
              />
            )
          ) : (
            <Box w="100%" h="100%" minH={aspectRatio === 1 ? "5rem" : "6rem"} />
          )}
        </Box>
        <Stack gap="2" align="flex-start" flex="1" minW="12rem">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            style={{ display: "none" }}
            disabled={fieldDisabled}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              upload.handleFileInput(file);
            }}
          />
          <HStack gap="2" flexWrap="wrap">
            <PondButton
              size="sm"
              colorPalette="sky"
              variant="outline"
              loading={upload.busy}
              disabled={fieldDisabled}
              onClick={() => fileRef.current?.click()}
            >
              Upload
            </PondButton>
            <PondButton
              size="sm"
              colorPalette="sky"
              variant="outline"
              disabled={fieldDisabled}
              onClick={openPicker}
            >
              {myImagesLabel}
            </PondButton>
            {imageKey.trim() ? (
              <PondButton
                size="sm"
                colorPalette="nautical"
                variant="outline"
                disabled={fieldDisabled}
                onClick={() => {
                  setPickedViewUrl("");
                  onImageKeyChange("");
                }}
              >
                Remove
              </PondButton>
            ) : null}
          </HStack>
          {upload.busy ? (
            <Stack gap="1" w="100%" maxW="16rem">
              <UploadProgressBar progress={upload.progress} />
              {upload.statusMessage ? (
                <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted" aria-live="polite">
                  {upload.statusMessage}
                </Text>
              ) : null}
            </Stack>
          ) : null}
          {!upload.busy && upload.statusKind === "success" && upload.statusMessage ? (
            <Text
              fontSize={APP_TEXT_SIZES.helper}
              color="lilypad.fg"
              fontWeight="medium"
              aria-live="polite"
            >
              {upload.statusMessage}
            </Text>
          ) : null}
          {upload.error ? (
            <Text fontSize={APP_TEXT_SIZES.helper} color="nautical.solid" role="alert">
              {upload.error}
            </Text>
          ) : null}
        </Stack>
      </HStack>

      <AppModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Choose an image"
        size="lg"
        description={inventoryDescription}
      >
        {pickerBusy ? (
          <Text fontSize={APP_TEXT_SIZES.helper}>Loading…</Text>
        ) : inventoryErr ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="nautical.solid" role="alert">
            {inventoryErr}
          </Text>
        ) : inventoryRows.length === 0 ? (
          <Text fontSize={APP_TEXT_SIZES.helper} color="fg.muted">
            No images yet. Upload a photo first.
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
                  setPickedViewUrl(row.image_url);
                  setPickerOpen(false);
                }}
                _hover={{ borderColor: "sky.border", boxShadow: "sm" }}
              >
                <PresignedImage
                  src={row.image_url}
                  imageKey={row.image_key}
                  getApiAccessToken={getApiAccessToken}
                  alt=""
                  w="100%"
                  aspectRatio={pickerAspect}
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
