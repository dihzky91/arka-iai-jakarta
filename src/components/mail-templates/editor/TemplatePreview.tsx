"use client";

import { useMemo } from "react";
import { compileBlocksToHtml } from "@/lib/email/template-engine/compiler";
import { resolveVariables } from "@/lib/email/template-engine/variable-resolver";
import { getAllSampleData } from "@/lib/email/template-engine/variable-registry";
import type { TemplateBlock } from "@/lib/email/template-engine/types";

interface Props {
  blocks: TemplateBlock[];
  subject: string;
  mode: "desktop" | "mobile";
  category: string;
  customSampleData?: Record<string, string>;
}

export function TemplatePreview({ blocks, subject, mode, category, customSampleData }: Props) {
  const sampleData = useMemo(() => {
    const defaults = getAllSampleData();
    return { ...defaults, ...(customSampleData ?? {}) };
  }, [customSampleData]);

  const compiledHtml = useMemo(() => {
    if (blocks.length === 0) return "";
    try {
      return compileBlocksToHtml(blocks, sampleData);
    } catch {
      return "<p style='color:red;'>Error compiling template</p>";
    }
  }, [blocks, sampleData]);

  const resolvedSubject = useMemo(
    () => resolveVariables(subject, sampleData),
    [subject, sampleData],
  );

  // Build a simple wrapper for preview (without server-side layout)
  const fullHtml = useMemo(() => {
    const year = new Date().getFullYear();
    return `
      <div style="background:#f4f4f5;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
          <div style="padding:20px 24px;border-bottom:2px solid #1d4ed8;">
            <span style="font-size:18px;font-weight:bold;color:#1d4ed8;">ARKA</span>
          </div>
          <div style="padding:24px;">
            ${compiledHtml}
          </div>
          <div style="padding:12px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;text-align:center;">
            © ${year} ARKA • IAI Wilayah DKI Jakarta
          </div>
        </div>
      </div>
    `;
  }, [compiledHtml]);

  return (
    <div className="space-y-2">
      {/* Subject Preview */}
      <div className="rounded border bg-muted/50 px-3 py-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Subject</p>
        <p className="text-sm font-medium truncate">
          {resolvedSubject || "(kosong)"}
        </p>
      </div>

      {/* HTML Preview */}
      <div
        className="rounded-lg border overflow-hidden"
        style={{
          maxWidth: mode === "mobile" ? "320px" : "100%",
          margin: mode === "mobile" ? "0 auto" : undefined,
        }}
      >
        {blocks.length === 0 ? (
          <div className="flex items-center justify-center p-12 text-xs text-muted-foreground">
            Preview akan muncul saat ada block
          </div>
        ) : (
          <div
            className="text-sm"
            dangerouslySetInnerHTML={{ __html: fullHtml }}
          />
        )}
      </div>
    </div>
  );
}
