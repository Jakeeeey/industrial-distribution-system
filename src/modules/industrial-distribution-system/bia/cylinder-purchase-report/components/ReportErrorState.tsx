import { CircleAlert, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface ReportErrorStateProps {
  message: string;
  onRetry(): void;
  variant?: "full" | "inline";
}
export function ReportErrorState({
  message,
  onRetry,
  variant = "full",
}: ReportErrorStateProps): React.ReactElement {
  const isInline = variant === "inline";

  return (
    <Card
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={
        isInline
          ? "border-destructive/40 py-3"
          : "border-destructive/40 py-5"
      }
    >
      <CardContent
        className={
          isInline
            ? "flex flex-col items-start gap-3 px-4 sm:flex-row sm:items-center sm:justify-between"
            : "flex flex-col items-start gap-4 px-5 sm:flex-row sm:items-center sm:justify-between"
        }
      >
        <div className="flex items-start gap-3">
          <CircleAlert
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-destructive"
          />
          <div>
            <p className={isInline ? "text-sm font-semibold" : "font-semibold"}>
              {isInline
                ? "Unable to refresh the report"
                : "Unable to load the report"}
            </p>
            <p
              className={
                isInline
                  ? "mt-0.5 text-sm text-muted-foreground"
                  : "mt-1 text-sm text-muted-foreground"
              }
            >
              {message}
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          <RotateCw aria-hidden="true" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}
