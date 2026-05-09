import * as Sentry from "@sentry/react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import RootErrorFallback from "./RootErrorFallback";

type Props = { children: ReactNode };

type State = { error: unknown | null };

/**
 * Catches uncaught React render errors below `ChakraProvider` so the shell never goes silently blank.
 */
export default class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo): void {
    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
    });
  }

  render(): ReactNode {
    if (this.state.error != null) {
      return <RootErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
