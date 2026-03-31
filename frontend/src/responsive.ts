import { useEffect, useState } from "react";

// Align with Chakra default `md` breakpoint (48em ~= 768px).
export const DESKTOP_MIN_WIDTH_PX = 768;

function getIsMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.innerWidth < DESKTOP_MIN_WIDTH_PX;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(getIsMobileViewport);

  useEffect(() => {
    const onResize = () => {
      setIsMobile(getIsMobileViewport());
    };

    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return isMobile;
}
