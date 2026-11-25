"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface Props {
  title: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/** Each panel is isolated: a failing widget cannot take down the terminal. */
export class PanelErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Unknown panel error",
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // Never include account tokens in diagnostics.
    console.error(`[VORTEX] ${this.props.title} panel error`, error, info.componentStack);
  }

  private reset = () => this.setState({ hasError: false, message: "" });

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl border border-crimson/30 bg-crimson/5 p-4 text-center">
          <AlertTriangle size={16} className="text-crimson" />
          <p className="text-xs font-semibold text-ink">{this.props.title} failed to render</p>
          <p className="max-w-[36ch] text-[10px] leading-relaxed text-ink-muted">{this.state.message}</p>
          <button
            type="button"
            onClick={this.reset}
            className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-panel-2 px-2 py-1 text-[10px] text-ink-muted hover:text-ink"
          >
            <RotateCcw size={11} /> Retry panel
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default PanelErrorBoundary;
