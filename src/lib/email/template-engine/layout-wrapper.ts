import { db } from "@/server/db";
import { emailLayouts } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { resolveVariablesSafe } from "./variable-resolver";

/**
 * Wrap compiled HTML content with a layout (header + footer).
 * If no layoutId is provided, uses the default layout.
 * If no layout found, wraps with a basic email structure.
 */
export async function wrapWithLayout(
  contentHtml: string,
  variables: Record<string, string>,
  layoutId?: string | null,
): Promise<string> {
  let headerHtml = "";
  let footerHtml = "";

  if (layoutId) {
    const layout = await db
      .select()
      .from(emailLayouts)
      .where(eq(emailLayouts.id, layoutId))
      .limit(1);

    if (layout[0]) {
      headerHtml = layout[0].headerHtml ?? "";
      footerHtml = layout[0].footerHtml ?? "";
    }
  } else {
    // Try to find default layout
    const defaultLayout = await db
      .select()
      .from(emailLayouts)
      .where(eq(emailLayouts.isDefault, true))
      .limit(1);

    if (defaultLayout[0]) {
      headerHtml = defaultLayout[0].headerHtml ?? "";
      footerHtml = defaultLayout[0].footerHtml ?? "";
    }
  }

  // Resolve variables in layout HTML
  const resolvedHeader = headerHtml
    ? resolveVariablesSafe(headerHtml, variables)
    : getDefaultHeader(variables);
  const resolvedFooter = footerHtml
    ? resolveVariablesSafe(footerHtml, variables)
    : getDefaultFooter(variables);

  return buildEmailWrapper(resolvedHeader, contentHtml, resolvedFooter);
}

function getDefaultHeader(variables: Record<string, string>): string {
  const logoUrl = variables["app.logo_url"] ?? "";
  const appName = variables["app.name"] ?? "ARKA";
  const logoImg = logoUrl
    ? `<img src="${logoUrl}" alt="${appName}" width="120" style="display:block;"/>`
    : `<span style="font-size:20px;font-weight:bold;color:#1d4ed8;">${appName}</span>`;
  return `<tr><td style="padding:24px 32px;border-bottom:2px solid #1d4ed8;">${logoImg}</td></tr>`;
}

function getDefaultFooter(variables: Record<string, string>): string {
  const year = variables["current.year"] ?? new Date().getFullYear().toString();
  const appName = variables["app.name"] ?? "ARKA";
  const orgName = variables["org.nama"] ?? "IAI Wilayah DKI Jakarta";
  return `<tr><td style="padding:16px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;text-align:center;">&copy; ${year} ${appName} &bull; ${orgName}</td></tr>`;
}

function buildEmailWrapper(
  headerHtml: string,
  contentHtml: string,
  footerHtml: string,
): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="color-scheme" content="light only"/>
  <meta name="supported-color-schemes" content="light only"/>
  <title>Email</title>
  <!--[if mso]>
  <style>table{border-collapse:collapse;}td{font-family:Arial,sans-serif;}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:24px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;max-width:600px;width:100%;">
          ${headerHtml}
          <tr><td style="padding:32px;color:#1e293b;">${contentHtml}</td></tr>
          ${footerHtml}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
