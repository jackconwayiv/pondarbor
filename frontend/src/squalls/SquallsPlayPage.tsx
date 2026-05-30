import { useLocation } from "react-router";

import ShantiesHome from "./ShantiesHome";
import type { SquallsPlayIntent } from "./squallsPlayIntent";

export default function SquallsPlayPage() {
  const location = useLocation();
  return (
    <ShantiesHome playIntent={(location.state ?? null) as SquallsPlayIntent | null} />
  );
}
