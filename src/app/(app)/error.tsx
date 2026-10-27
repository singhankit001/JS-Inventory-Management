"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RotateCw } from "lucide-react";
import { ErrorState } from "@/components/ui/states";
import { Button, buttonClass } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  // Most failures come from server components: refresh refetches them, reset re-renders the boundary.
  const retry = () => start(() => { router.refresh(); reset(); });
  return (
    <div className="card mx-auto mt-10 max-w-xl p-6" role="alert">
      <ErrorState
        title="This page couldn't load"
        body={error.digest ? `Reference ${error.digest}. The error has been logged; trying again usually works.` : "Try again, or return to your dashboard."}
        action={
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button variant="primary" size="sm" onClick={retry} disabled={pending}><RotateCw className={pending ? "animate-spin" : undefined} />{pending ? "Retrying…" : "Try again"}</Button>
            {/* "/" redirects to the signed-in role's dashboard. */}
            <Link href="/" className={buttonClass("secondary", "sm")}>My dashboard</Link>
          </div>
        }
      />
    </div>
  );
}
