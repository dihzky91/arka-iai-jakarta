import type { TemplateBlock } from "./types";
import { resolveVariables } from "./variable-resolver";

/**
 * Compile an array of TemplateBlocks into plain text (email fallback).
 */
export function compileBlocksToText(
  blocks: TemplateBlock[],
  variables: Record<string, string>,
): string {
  const parts = blocks.map((block) => compileBlockText(block, variables));
  return parts.filter(Boolean).join("\n\n");
}

function compileBlockText(
  block: TemplateBlock,
  variables: Record<string, string>,
): string {
  switch (block.type) {
    case "paragraph":
      return resolveVariables(block.content, variables);
    case "heading":
      return resolveVariables(block.content, variables).toUpperCase();
    case "button":
      return `${resolveVariables(block.label, variables)}: ${resolveVariables(block.url, variables)}`;
    case "divider":
      return "───────────────────────────────";
    case "spacer":
      return "";
    case "image":
      return `[Gambar: ${resolveVariables(block.alt, variables)}]`;
    case "alert":
      return `[${block.variant.toUpperCase()}] ${resolveVariables(block.content, variables)}`;
    case "table":
      return compileTableText(block, variables);
    case "list":
      return compileListText(block, variables);
    case "columns":
      return block.columns
        .map((col) => compileBlocksToText(col.blocks, variables))
        .join("\n\n");
    case "signature":
      return `— ${variables["app.name"] ?? "ARKA"}`;
    default:
      return "";
  }
}

function compileTableText(
  block: Extract<TemplateBlock, { type: "table" }>,
  variables: Record<string, string>,
): string {
  const headerLine = block.headers
    .map((h) => resolveVariables(h, variables))
    .join(" | ");
  const rows = block.rows
    .map((row) =>
      row.map((cell) => resolveVariables(cell, variables)).join(" | "),
    )
    .join("\n");
  return `${headerLine}\n${rows}`;
}

function compileListText(
  block: Extract<TemplateBlock, { type: "list" }>,
  variables: Record<string, string>,
): string {
  return block.items
    .map((item, i) => {
      const prefix = block.ordered ? `${i + 1}.` : "•";
      return `${prefix} ${resolveVariables(item, variables)}`;
    })
    .join("\n");
}
