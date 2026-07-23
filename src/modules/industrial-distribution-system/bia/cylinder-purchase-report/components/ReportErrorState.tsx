import { CircleAlert, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface ReportErrorStateProps {
  message: string;
  onRetry(): void;
}
export function ReportErrorState({
  message,
  onRetry,
}: ReportErrorStateProps): React.ReactElement {
  return (
    <Card role="alert" className="border-destructive/40 py-5">
      <CardContent className="flex flex-col items-start gap-4 px-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <CircleAlert
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0 text-destructive"
          />
          <div>
            <p className="font-semibold">Unable to load the report</p>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
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
