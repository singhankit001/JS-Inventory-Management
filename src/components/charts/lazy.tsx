"use client";

// Recharts is the heaviest client dependency; load it after the dashboard shell has painted.
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/states";

export const TrendChart = dynamic(() => import("./interactive").then((m) => m.TrendChart), { ssr: false, loading: () => <Skeleton className="h-[240px] w-full" /> });
export const FlowBars = dynamic(() => import("./interactive").then((m) => m.FlowBars), { ssr: false, loading: () => <Skeleton className="h-[120px] w-full" /> });
export const ColumnChart = dynamic(() => import("./interactive").then((m) => m.ColumnChart), { ssr: false, loading: () => <Skeleton className="h-[220px] w-full" /> });
