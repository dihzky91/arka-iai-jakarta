"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { VariableDefinition } from "@/lib/email/template-engine/types";

interface Props {
  variables: VariableDefinition[];
  sampleData: Record<string, string>;
  onSampleDataChange: (data: Record<string, string>) => void;
}

export function SampleDataEditor({
  variables,
  sampleData,
  onSampleDataChange,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  function handleReset() {
    const defaults: Record<string, string> = {};
    for (const v of variables) {
      defaults[v.key] = v.sampleValue;
    }
    onSampleDataChange(defaults);
  }

  function handleChange(key: string, value: string) {
    onSampleDataChange({ ...sampleData, [key]: value });
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium hover:bg-accent/50 transition-colors"
      >
        <span>Sample Data (Preview)</span>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>

      {expanded && (
        <div className="border-t px-3 py-2 space-y-2">
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-6 text-[10px]"
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Reset ke default
            </Button>
          </div>

          <div className="max-h-[250px] overflow-y-auto space-y-1.5">
            {variables.map((v) => (
              <div key={v.key} className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-muted-foreground w-32 shrink-0 truncate">
                  {v.key}
                </span>
                <Input
                  value={sampleData[v.key] ?? v.sampleValue}
                  onChange={(e) => handleChange(v.key, e.target.value)}
                  className="h-6 text-xs flex-1"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
