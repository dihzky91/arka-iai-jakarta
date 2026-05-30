"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { VariableDefinition } from "@/lib/email/template-engine/types";

interface Props {
  variables: VariableDefinition[];
}

export function VariablePanel({ variables }: Props) {
  const [search, setSearch] = useState("");

  const filtered = variables.filter(
    (v) =>
      !search ||
      v.key.toLowerCase().includes(search.toLowerCase()) ||
      v.label.toLowerCase().includes(search.toLowerCase()),
  );

  function copyVariable(key: string) {
    navigator.clipboard.writeText(`{{${key}}}`);
    toast.success(`{{${key}}} disalin`);
  }

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Variabel</p>
        <span className="text-[10px] text-muted-foreground">
          Klik untuk copy
        </span>
      </div>

      <div className="relative">
        <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari variabel..."
          className="h-7 pl-7 text-xs"
        />
      </div>

      <div className="max-h-[300px] overflow-y-auto space-y-0.5">
        {filtered.map((v) => (
          <button
            key={v.key}
            onClick={() => copyVariable(v.key)}
            className="flex w-full items-center justify-between rounded px-2 py-1 text-left hover:bg-accent transition-colors"
            title={`Sample: ${v.sampleValue}`}
          >
            <span className="font-mono text-[11px] text-primary">
              {`{{${v.key}}}`}
            </span>
            <span className="text-[10px] text-muted-foreground truncate ml-2 max-w-[100px]">
              {v.label}
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Tidak ditemukan
          </p>
        )}
      </div>
    </div>
  );
}
