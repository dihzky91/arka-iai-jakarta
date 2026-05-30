import type { TemplateBlock } from "./types";
import { resolveVariablesSafe } from "./variable-resolver";

/**
 * Compile an array of TemplateBlocks into email-safe HTML.
 * Uses table-based layout for maximum email client compatibility.
 */
export function compileBlocksToHtml(
  blocks: TemplateBlock[],
  variables: Record<string, string>,
): string {
  const htmlParts = blocks.map((block) => compileBlock(block, variables));
  return htmlParts.join("\n");
}

function compileBlock(
  block: TemplateBlock,
  variables: Record<string, string>,
): string {
  switch (block.type) {
    case "paragraph":
      return compileParagraph(block, variables);
    case "heading":
      return compileHeading(block, variables);
    case "button":
      return compileButton(block, variables);
    case "divider":
      return compileDivider(block);
    case "spacer":
      return compileSpacer(block);
    case "image":
      return compileImage(block, variables);
    case "alert":
      return compileAlert(block, variables);
    case "table":
      return compileTable(block, variables);
    case "list":
      return compileList(block, variables);
    case "columns":
      return compileColumns(block, variables);
    case "signature":
      return compileSignature(variables);
    default:
      return "";
  }
}

function compileParagraph(
  block: Extract<TemplateBlock, { type: "paragraph" }>,
  variables: Record<string, string>,
): string {
  const align = block.align ?? "left";
  const fontWeight = block.bold ? "font-weight:bold;" : "";
  const fontStyle = block.italic ? "font-style:italic;" : "";
  const content = resolveVariablesSafe(block.content, variables);
  return `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#1f2937;text-align:${align};${fontWeight}${fontStyle}">${content}</p>`;
}

function compileHeading(
  block: Extract<TemplateBlock, { type: "heading" }>,
  variables: Record<string, string>,
): string {
  const align = block.align ?? "left";
  const tag = `h${block.level}`;
  const sizes: Record<number, string> = { 1: "24px", 2: "20px", 3: "16px" };
  const size = sizes[block.level] ?? "16px";
  const content = resolveVariablesSafe(block.content, variables);
  return `<${tag} style="margin:0 0 16px 0;font-size:${size};font-weight:bold;color:#111827;text-align:${align};">${content}</${tag}>`;
}

function compileButton(
  block: Extract<TemplateBlock, { type: "button" }>,
  variables: Record<string, string>,
): string {
  const align = block.align ?? "center";
  const color = block.color ?? "#1d4ed8";
  const url = resolveVariablesSafe(block.url, variables);
  const label = resolveVariablesSafe(block.label, variables);
  const width = block.fullWidth ? "width:100%;" : "";
  // Bulletproof button using table for Outlook compatibility
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;${block.fullWidth ? "width:100%;" : ""}"><tr><td align="${align}"><a href="${url}" target="_blank" style="display:inline-block;padding:12px 24px;background-color:${color};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:6px;${width}">${label}</a></td></tr></table>`;
}

function compileDivider(
  block: Extract<TemplateBlock, { type: "divider" }>,
): string {
  const style = block.style ?? "solid";
  const color = block.color ?? "#e5e7eb";
  return `<hr style="margin:16px 0;border:none;border-top:1px ${style} ${color};"/>`;
}

function compileSpacer(
  block: Extract<TemplateBlock, { type: "spacer" }>,
): string {
  return `<div style="height:${block.height}px;line-height:${block.height}px;font-size:1px;">&nbsp;</div>`;
}

function compileImage(
  block: Extract<TemplateBlock, { type: "image" }>,
  variables: Record<string, string>,
): string {
  const align = block.align ?? "center";
  const src = resolveVariablesSafe(block.src, variables);
  const alt = resolveVariablesSafe(block.alt, variables);
  const width = block.width ? `width="${block.width}"` : 'width="100%"';
  const img = `<img src="${src}" alt="${alt}" ${width} style="display:block;max-width:100%;height:auto;border:0;"/>`;
  const wrapped = block.linkUrl
    ? `<a href="${resolveVariablesSafe(block.linkUrl, variables)}" target="_blank">${img}</a>`
    : img;
  return `<div style="margin:0 0 16px 0;text-align:${align};">${wrapped}</div>`;
}

function compileAlert(
  block: Extract<TemplateBlock, { type: "alert" }>,
  variables: Record<string, string>,
): string {
  const colorMap = {
    info: { bg: "#eff6ff", border: "#3b82f6", text: "#1e40af" },
    warning: { bg: "#fffbeb", border: "#f59e0b", text: "#92400e" },
    success: { bg: "#f0fdf4", border: "#22c55e", text: "#166534" },
    error: { bg: "#fef2f2", border: "#ef4444", text: "#991b1b" },
  } as const;
  const c = colorMap[block.variant];
  const content = resolveVariablesSafe(block.content, variables);
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;"><tr><td style="padding:12px 16px;background-color:${c.bg};border-left:4px solid ${c.border};border-radius:4px;color:${c.text};font-size:14px;line-height:1.5;">${content}</td></tr></table>`;
}

function compileTable(
  block: Extract<TemplateBlock, { type: "table" }>,
  variables: Record<string, string>,
): string {
  const headerCells = block.headers
    .map(
      (h) =>
        `<th style="padding:8px 12px;background-color:#f3f4f6;border:1px solid #e5e7eb;font-size:13px;font-weight:600;text-align:left;color:#374151;">${resolveVariablesSafe(h, variables)}</th>`,
    )
    .join("");
  const rows = block.rows
    .map((row, rowIdx) => {
      const bgColor =
        block.striped && rowIdx % 2 === 1 ? "background-color:#f9fafb;" : "";
      const cells = row
        .map(
          (cell) =>
            `<td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:14px;color:#1f2937;${bgColor}">${resolveVariablesSafe(cell, variables)}</td>`,
        )
        .join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;border-collapse:collapse;"><thead><tr>${headerCells}</tr></thead><tbody>${rows}</tbody></table>`;
}

function compileList(
  block: Extract<TemplateBlock, { type: "list" }>,
  variables: Record<string, string>,
): string {
  const tag = block.ordered ? "ol" : "ul";
  const items = block.items
    .map(
      (item) =>
        `<li style="margin:0 0 4px 0;font-size:14px;line-height:1.5;color:#1f2937;">${resolveVariablesSafe(item, variables)}</li>`,
    )
    .join("");
  return `<${tag} style="margin:0 0 16px 0;padding-left:24px;">${items}</${tag}>`;
}

function compileColumns(
  block: Extract<TemplateBlock, { type: "columns" }>,
  variables: Record<string, string>,
): string {
  const widthMap: Record<string, string> = {
    "1/2": "50%",
    "1/3": "33.33%",
    "2/3": "66.67%",
  };
  const cols = block.columns
    .map((col) => {
      const w = widthMap[col.width] ?? "50%";
      const innerHtml = compileBlocksToHtml(col.blocks, variables);
      return `<td style="width:${w};vertical-align:top;padding:0 8px;">${innerHtml}</td>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px 0;"><tr>${cols}</tr></table>`;
}

function compileSignature(variables: Record<string, string>): string {
  const appName = variables["app.name"] ?? "ARKA";
  const orgName = variables["org.nama"] ?? "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0 0;border-top:1px solid #e5e7eb;padding-top:16px;"><tr><td style="font-size:13px;color:#6b7280;line-height:1.4;">— ${appName}${orgName ? ` • ${orgName}` : ""}</td></tr></table>`;
}
