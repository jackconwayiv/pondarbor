import { Image, type ImageProps } from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { requestPresignRead } from "./r2ImageApi";

export type PresignedImageProps = ImageProps & {
  /** R2 object key for presign-read refresh when the presigned src expires. */
  imageKey?: string | null;
  getApiAccessToken?: () => Promise<string>;
  /** When no imageKey (e.g. friend avatar), refetch parent data on load error. */
  onRefresh?: () => void | Promise<void>;
};

export default function PresignedImage({
  src,
  imageKey,
  getApiAccessToken,
  onRefresh,
  onError,
  ...rest
}: PresignedImageProps) {
  const [currentSrc, setCurrentSrc] = useState((src ?? "").trim());
  const retriedRef = useRef(false);

  useEffect(() => {
    setCurrentSrc((src ?? "").trim());
    retriedRef.current = false;
  }, [src]);

  const handleError = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
      if (retriedRef.current) {
        onError?.(event);
        return;
      }
      retriedRef.current = true;
      const key = (imageKey ?? "").trim();
      void (async () => {
        if (key && getApiAccessToken) {
          try {
            const token = await getApiAccessToken();
            const { view_url } = await requestPresignRead(token, key);
            if (view_url.trim()) {
              setCurrentSrc(view_url.trim());
              return;
            }
          } catch {
            // fall through to onRefresh / onError
          }
        }
        if (onRefresh) {
          try {
            await onRefresh();
            return;
          } catch {
            // fall through
          }
        }
        onError?.(event);
      })();
    },
    [getApiAccessToken, imageKey, onError, onRefresh],
  );

  if (!currentSrc) {
    return null;
  }

  return <Image src={currentSrc} onError={handleError} {...rest} />;
}
