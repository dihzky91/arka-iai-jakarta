"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { VariableDefinition } from "@/lib/email/template-engine/types";

interface Props {
  value: string;
  onChange: (value: string) => void;
  variables: VariableDefinition[];
  placeholder?: string;
  multiline?: boolean;
  className?: string;
}

/**
 * Input/Textarea with variable autocomplete.
 * Shows suggestions when user types "{{".
 */
export function VariableInput({
  value,
  onChange,
  variables,
  placeholder,
  multiline,
  className,
}: Props) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filter, setFilter] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  const filteredVars = variables.filter(
    (v) =>
      !filter ||
      v.key.toLowerCase().includes(filter.toLowerCase()) ||
      v.label.toLowerCase().includes(filter.toLowerCase()),
  );

  const handleChange = useCallback(
    (newValue: string, selectionStart: number) => {
      onChange(newValue);
      setCursorPos(selectionStart);

      // Check if we're inside {{ ... }}
      const textBefore = newValue.slice(0, selectionStart);
      const lastOpen = textBefore.lastIndexOf("{{");
      const lastClose = textBefore.lastIndexOf("}}");

      if (lastOpen > lastClose) {
        // We're inside a {{ block
        const partial = textBefore.slice(lastOpen + 2);
        setFilter(partial);
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
        setFilter("");
      }
    },
    [onChange],
  );

  const insertVariable = useCallback(
    (varKey: string) => {
      const textBefore = value.slice(0, cursorPos);
      const lastOpen = textBefore.lastIndexOf("{{");
      const textAfter = value.slice(cursorPos);

      // Find if there's a closing }} after cursor
      const closingIdx = textAfter.indexOf("}}");
      const afterClose = closingIdx >= 0 ? textAfter.slice(closingIdx + 2) : textAfter;

      const newValue = value.slice(0, lastOpen) + `{{${varKey}}}` + afterClose;
      onChange(newValue);
      setShowSuggestions(false);
      setFilter("");

      // Focus back
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [value, cursorPos, onChange],
  );

  // Close suggestions on blur (with delay for click)
  const handleBlur = useCallback(() => {
    setTimeout(() => setShowSuggestions(false), 200);
  }, []);

  const commonProps = {
    value,
    placeholder,
    onBlur: handleBlur,
    className: `text-xs h-8 ${className ?? ""}`,
  };

  return (
    <div className="relative">
      {multiline ? (
        <Textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          {...commonProps}
          className={`text-xs min-h-[60px] ${className ?? ""}`}
          rows={2}
          onChange={(e) => handleChange(e.target.value, e.target.selectionStart ?? 0)}
          onKeyUp={(e) => {
            const target = e.target as HTMLTextAreaElement;
            handleChange(target.value, target.selectionStart ?? 0);
          }}
        />
      ) : (
        <Input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          {...commonProps}
          onChange={(e) => handleChange(e.target.value, e.target.selectionStart ?? 0)}
          onKeyUp={(e) => {
            const target = e.target as HTMLInputElement;
            handleChange(target.value, target.selectionStart ?? 0);
          }}
        />
      )}

      {/* Autocomplete Dropdown */}
      {showSuggestions && filteredVars.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
          {filteredVars.slice(0, 15).map((v) => (
            <button
              key={v.key}
              onMouseDown={(e) => {
                e.preventDefault();
                insertVariable(v.key);
              }}
              className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-accent"
            >
              <span className="font-mono text-primary">{`{{${v.key}}}`}</span>
              <span className="ml-2 text-muted-foreground truncate max-w-[120px]">
                {v.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
