"use client";

import { Component, type ReactNode } from "react";
import { ErrorState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";

/** Isolates one widget so a failing chart cannot take down the whole dashboard. */
export class WidgetBoundary extends Component<{ children: ReactNode; name: string }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error(`[widget:${this.props.name}]`, error);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="card p-6">
        <ErrorState title={`${this.props.name} failed to load`} body="The rest of the dashboard is unaffected." action={<Button size="sm" onClick={() => this.setState({ failed: false })}>Try again</Button>} />
      </div>
    );
  }
}
