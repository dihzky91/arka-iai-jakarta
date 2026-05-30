"use client";

import { Label } from "@/components/ui/label";
import { VariableInput } from "./VariableInput";
import type { VariableDefinition } from "@/lib/email/template-engine/types";

interface Props {
  value: string;
  onChange: (value: string) => void;
  variables: VariableDefinition[];
}

export function SubjectEditor({ value, onChange, variables }: Props) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">Subject Email</Label>
      <VariableInput
        value={value}
        onChange={onChange}
        variables={variables}
        placeholder="Subject email... (ketik {{ untuk variabel)"
      />
    </div>
  );
}
