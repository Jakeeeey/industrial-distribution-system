"use client";

import React from "react";
import { FileText, Image as ImageIcon, Paperclip } from "lucide-react";
import { StockAdjustmentAttachment } from "../types/stock-adjustment-serial.schema";

// AG-COMMENT: Read-only attachment list for Stock Adjustment Posting module (uploads disabled)
interface AttachmentUploadProps {
  value?: StockAdjustmentAttachment[];
  onChange?: (value: StockAdjustmentAttachment[]) => void;
  disabled?: boolean;
}

export function AttachmentUpload({
  value = [],
}: AttachmentUploadProps) {
  if (!value || value.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-muted/10 border border-dashed border-border rounded-xl text-center">
        <Paperclip className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-xs font-semibold text-muted-foreground">No attachments uploaded for this document</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {value.map((att, index) => {
          const uuid = typeof att.attachment === "object" ? att.attachment.id : att.attachment;
          const isImage = typeof att.attachment === "object" && att.attachment.type?.startsWith("image");
          const filename = typeof att.attachment === "object" ? att.attachment.filename_download : uuid;

          return (
            <div
              key={index}
              className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg shadow-sm"
            >
              <div className="h-9 w-9 shrink-0 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                {isImage ? <ImageIcon className="h-4.5 w-4.5" /> : <FileText className="h-4.5 w-4.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate text-foreground">{filename}</p>
                <span className="text-[10px] text-muted-foreground font-mono">Attachment #{index + 1}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
