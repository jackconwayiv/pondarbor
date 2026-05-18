import { Outlet } from "react-router";

import { WhatIfResumeProvider } from "./WhatIfResumeContext";

export default function WhatIfLayout() {
  return (
    <WhatIfResumeProvider>
      <Outlet />
    </WhatIfResumeProvider>
  );
}
