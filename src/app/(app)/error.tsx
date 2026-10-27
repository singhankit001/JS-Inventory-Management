"use client";

import { ErrorState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto mt-10 max-w-xl p-6">
      <ErrorState body={error.digest ? `Reference ${error.digest}. The error has been logged.` : "Try again, or return to your dashboard."} action={<Button variant="primary" size="sm" onClick={reset}>Try again</Button>} />
    </div>
  );
}
