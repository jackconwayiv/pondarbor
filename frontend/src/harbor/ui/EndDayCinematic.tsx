/**
 * Pure CSS sun→twilight→moon→dawn animation. Runs ~1.6s. Tap to skip.
 */

import { useEffect } from "react";

type Props = {
  onDone: () => void;
};

const DURATION_MS = 1600;

export default function EndDayCinematic({ onDone }: Props) {
  useEffect(() => {
    const id = window.setTimeout(onDone, DURATION_MS);
    return () => window.clearTimeout(id);
  }, [onDone]);
  return (
    <div
      className="harbor-cinematic"
      onClick={onDone}
      onTouchStart={onDone}
      role="presentation"
    >
      {/* Base: day → dusk → night. Dawn is a second layer (opacity) so the return
        to light cross-fades smoothly—browsers flash when animating one gradient. */}
      <div
        className="harbor-cinematic__skyBase"
        aria-hidden
      />
      <div
        className="harbor-cinematic__skyDawn"
        aria-hidden
      />
      <div className="harbor-cinematic__arc harbor-cinematic__arc--sun">
        <div className="harbor-cinematic__orb harbor-cinematic__orb--sun" />
      </div>
      <div className="harbor-cinematic__arc harbor-cinematic__arc--moon">
        <div className="harbor-cinematic__orb harbor-cinematic__orb--moon" />
      </div>
      <button
        type="button"
        className="harbor-cinematic__skip"
        onClick={(e) => {
          e.stopPropagation();
          onDone();
        }}
      >
        Skip
      </button>
    </div>
  );
}
