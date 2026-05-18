"use server";

import { and, count, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  pplKegiatan,
  pplKuesionerLink,
  pplKuesionerResponse,
  pplKuesionerTemplate,
} from "@/server/db/schema";
import { submitResponseSchema } from "@/lib/validators/ppl-evaluasi";
import { requireSession } from "@/server/actions/auth";
import type { FormField } from "@/components/ppl-evaluasi/form-builder/types";
import type {
  ActionResult,
  PaginatedResult,
  PaginationOpts,
  PublicKuesionerData,
  ResponseRow,
  SubmitResponseInput,
} from "./types";

// ─── GET KUESIONER BY TOKEN (PUBLIC) ─────────────────────────────────────────

export async function getKuesionerByToken(
  token: string,
): Promise<PublicKuesionerData | null> {
  if (!token || token.trim().length === 0) {
    return null;
  }

  const [result] = await db
    .select({
      kegiatanNama: pplKegiatan.namaKegiatan,
      templateNama: pplKuesionerTemplate.nama,
      configJson: pplKuesionerTemplate.configJson,
      isActive: pplKuesionerLink.isActive,
    })
    .from(pplKuesionerLink)
    .innerJoin(
      pplKuesionerTemplate,
      eq(pplKuesionerLink.templateId, pplKuesionerTemplate.id),
    )
    .innerJoin(
      pplKegiatan,
      eq(pplKuesionerLink.kegiatanId, pplKegiatan.id),
    )
    .where(eq(pplKuesionerLink.accessToken, token))
    .limit(1);

  if (!result) {
    return null;
  }

  return {
    kegiatanNama: result.kegiatanNama,
    templateNama: result.templateNama,
    fields: result.configJson as FormField[],
    isActive: result.isActive,
  };
}

// ─── SUBMIT RESPONSE (PUBLIC) ────────────────────────────────────────────────

export async function submitResponse(
  token: string,
  data: SubmitResponseInput,
): Promise<ActionResult> {
  // Validate input schema
  const parsed = submitResponseSchema.safeParse(data);
  if (!parsed.success) {
    const firstError = parsed.error.errors[0];
    return {
      ok: false,
      error: firstError?.message ?? "Data tidak valid",
    };
  }

  const input = parsed.data;

  // Find the kuesioner link by token
  const [link] = await db
    .select({
      id: pplKuesionerLink.id,
      isActive: pplKuesionerLink.isActive,
      templateId: pplKuesionerLink.templateId,
    })
    .from(pplKuesionerLink)
    .where(eq(pplKuesionerLink.accessToken, token))
    .limit(1);

  if (!link) {
    return { ok: false, error: "Kuesioner tidak ditemukan" };
  }

  // Check if kuesioner is active (Req 4.7)
  if (!link.isActive) {
    return { ok: false, error: "Kuesioner sudah ditutup" };
  }

  // Fetch template config for required field validation
  const [template] = await db
    .select({ configJson: pplKuesionerTemplate.configJson })
    .from(pplKuesionerTemplate)
    .where(eq(pplKuesionerTemplate.id, link.templateId))
    .limit(1);

  if (!template) {
    return { ok: false, error: "Template kuesioner tidak ditemukan" };
  }

  const fields = template.configJson as FormField[];

  // Validate required fields (Req 4.4)
  const missingFields: string[] = [];
  for (const field of fields) {
    if (!field.required) continue;

    const answer = input.answers[field.id];

    if (field.type === "grid") {
      // Grid fields: answer should be an object with row keys
      if (!answer || typeof answer !== "object" || Array.isArray(answer)) {
        missingFields.push(field.label);
        continue;
      }
      const gridAnswer = answer as Record<string, unknown>;
      const config = field.config as { rows: string[] } | null;
      if (config?.rows) {
        for (let i = 0; i < config.rows.length; i++) {
          const rowValue = gridAnswer[String(i)];
          if (
            rowValue === undefined ||
            rowValue === null ||
            String(rowValue).trim().length === 0
          ) {
            missingFields.push(field.label);
            break;
          }
        }
      }
    } else if (field.type === "checkbox") {
      // Checkbox fields: answer should be a non-empty array
      if (!Array.isArray(answer) || answer.length === 0) {
        missingFields.push(field.label);
      }
    } else {
      // All other fields: must be a non-whitespace string or non-null value
      if (
        answer === undefined ||
        answer === null ||
        String(answer).trim().length === 0
      ) {
        missingFields.push(field.label);
      }
    }
  }

  if (missingFields.length > 0) {
    return {
      ok: false,
      error: `Field berikut wajib diisi: ${missingFields.join(", ")}`,
    };
  }

  // Check for duplicate submission (Req 4.5, 4.6)
  // The unique index on (linkId, lower(namaResponden), lower(emailResponden)) handles this,
  // but we check explicitly for a better error message
  const [existing] = await db
    .select({ id: pplKuesionerResponse.id })
    .from(pplKuesionerResponse)
    .where(
      and(
        eq(pplKuesionerResponse.linkId, link.id),
        sql`lower(${pplKuesionerResponse.namaResponden}) = lower(${input.namaResponden})`,
        sql`lower(${pplKuesionerResponse.emailResponden}) = lower(${input.emailResponden})`,
      ),
    )
    .limit(1);

  if (existing) {
    return {
      ok: false,
      error: "Respons sudah tercatat untuk peserta ini",
    };
  }

  // Store the response (Req 4.3)
  await db.insert(pplKuesionerResponse).values({
    linkId: link.id,
    namaResponden: input.namaResponden,
    emailResponden: input.emailResponden,
    answersJson: input.answers,
  });

  return { ok: true };
}

// ─── LIST RESPONSES (ADMIN) ──────────────────────────────────────────────────

export async function listResponses(
  kegiatanId: number,
  opts: PaginationOpts = {},
): Promise<PaginatedResult<ResponseRow>> {
  await requireSession();

  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 10;
  const offset = (page - 1) * pageSize;

  // Find the link for this kegiatan
  const [link] = await db
    .select({ id: pplKuesionerLink.id })
    .from(pplKuesionerLink)
    .where(eq(pplKuesionerLink.kegiatanId, kegiatanId))
    .limit(1);

  if (!link) {
    return {
      data: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  // Get total count
  const [totalResult] = await db
    .select({ count: count() })
    .from(pplKuesionerResponse)
    .where(eq(pplKuesionerResponse.linkId, link.id));

  const total = totalResult?.count ?? 0;

  // Get paginated responses
  const rows = await db
    .select({
      id: pplKuesionerResponse.id,
      namaResponden: pplKuesionerResponse.namaResponden,
      emailResponden: pplKuesionerResponse.emailResponden,
      submittedAt: pplKuesionerResponse.submittedAt,
    })
    .from(pplKuesionerResponse)
    .where(eq(pplKuesionerResponse.linkId, link.id))
    .orderBy(sql`${pplKuesionerResponse.submittedAt} DESC`)
    .limit(pageSize)
    .offset(offset);

  return {
    data: rows as ResponseRow[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
