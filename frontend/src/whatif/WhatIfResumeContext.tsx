import { createContext, useContext, type ReactNode } from "react";

import {
  useWhatIfResumeTargets,
  type WhatIfResumeTarget,
} from "./useWhatIfResumeTargets";

type WhatIfResumeContextValue = {
  targets: WhatIfResumeTarget[];
  loading: boolean;
};

const WhatIfResumeContext = createContext<WhatIfResumeContextValue | null>(
  null,
);

export function WhatIfResumeProvider({ children }: { children: ReactNode }) {
  const value = useWhatIfResumeTargets();
  return (
    <WhatIfResumeContext.Provider value={value}>
      {children}
    </WhatIfResumeContext.Provider>
  );
}

export function useWhatIfResumeContext(): WhatIfResumeContextValue {
  const ctx = useContext(WhatIfResumeContext);
  if (ctx == null) {
    throw new Error(
      "useWhatIfResumeContext must be used within WhatIfResumeProvider",
    );
  }
  return ctx;
}
