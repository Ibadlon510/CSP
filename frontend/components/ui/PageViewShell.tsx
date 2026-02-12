"use client";

import { PageViewToggle, type PageView } from "./PageViewToggle";

interface PageViewShellProps {
  viewMode: string;
  onViewChange: (mode: string) => void;
  views: PageView[];
  spreadsheet?: React.ReactNode;
  kanban?: React.ReactNode;
  timeline?: React.ReactNode;
  card?: React.ReactNode;
}

export function PageViewShell({
  viewMode,
  onViewChange,
  views,
  spreadsheet,
  kanban,
  timeline,
  card,
}: PageViewShellProps) {
  return (
    <>
      {viewMode === "spreadsheet" && spreadsheet}
      {viewMode === "kanban" && kanban}
      {viewMode === "timeline" && timeline}
      {viewMode === "card" && card}
    </>
  );
}
