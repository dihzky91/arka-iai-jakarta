import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { submitResponseSchema } from "@/lib/validators/ppl-evaluasi";
import type { FormField } from "@/components/ppl-evaluasi/form-builder/types";

/**
 * Property 6: Response Answers Round-Trip
 * Validates: Requirements 4.3
 *
 * For any valid set of answers submitted to a Kuesioner, retrieving the stored
 * response SHALL produce an answers object equivalent to the original submission.
 *
 * We test that the submitResponseSchema validates and preserves the answers
 * structure (round-trip through Zod validation).
 */
describe("Property 6: Response Answers Round-Trip", () => {
  // Generator for valid answer values (primitives that JSON can represent)
  const answerValue = fc.oneof(
    fc.string({ minLength: 1, maxLength: 100 }),
    fc.integer({ min: 1, max: 10 }),
    fc.array(fc.string({ minLength: 1, maxLength: 50 }), {
      minLength: 1,
      maxLength: 5,
    })
  );

  // Generator for a valid answers record with string keys.
  // Exclude reserved object keys (__proto__, constructor, prototype): Zod's
  // record parser intentionally strips these to prevent prototype pollution,
  // so they would not survive a round-trip by design.
  const RESERVED_KEYS = new Set(["__proto__", "constructor", "prototype"]);
  const validAnswers = fc.dictionary(
    fc
      .string({ minLength: 1, maxLength: 20 })
      .filter((s) => /^[a-zA-Z0-9_-]+$/.test(s) && !RESERVED_KEYS.has(s)),
    answerValue,
    { minKeys: 1, maxKeys: 10 }
  );

  // Generator for a valid response submission
  const validSubmission = fc.record({
    namaResponden: fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
    emailResponden: fc
      .tuple(
        fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9]+$/.test(s)),
        fc.string({ minLength: 2, maxLength: 10 }).filter((s) => /^[a-z]+$/.test(s))
      )
      .map(([local, domain]) => `${local}@${domain}.com`),
    answers: validAnswers,
  });

  it("SHALL preserve the answers object through Zod validation (round-trip)", () => {
    fc.assert(
      fc.property(validSubmission, (submission) => {
        const result = submitResponseSchema.safeParse(submission);
        expect(result.success).toBe(true);
        if (result.success) {
          // The answers object should be equivalent after validation
          expect(result.data.answers).toEqual(submission.answers);
        }
      }),
      { numRuns: 200 }
    );
  });

  it("SHALL preserve namaResponden and emailResponden through validation", () => {
    fc.assert(
      fc.property(validSubmission, (submission) => {
        const result = submitResponseSchema.safeParse(submission);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.namaResponden).toBe(submission.namaResponden);
          expect(result.data.emailResponden).toBe(submission.emailResponden);
        }
      }),
      { numRuns: 200 }
    );
  });

  it("SHALL accept answers with various value types (string, number, array)", () => {
    const mixedAnswers = fc.record({
      namaResponden: fc.constant("Test User"),
      emailResponden: fc.constant("test@example.com"),
      answers: fc.record({
        textField: fc.string({ minLength: 1, maxLength: 100 }),
        numberField: fc.integer({ min: 1, max: 10 }).map((n) => n as unknown),
        arrayField: fc
          .array(fc.string({ minLength: 1, maxLength: 50 }), {
            minLength: 1,
            maxLength: 5,
          })
          .map((a) => a as unknown),
      }),
    });

    fc.assert(
      fc.property(mixedAnswers, (submission) => {
        const result = submitResponseSchema.safeParse(submission);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.answers).toEqual(submission.answers);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("SHALL accept empty answers record", () => {
    const emptyAnswers = fc.record({
      namaResponden: fc.constant("Test User"),
      emailResponden: fc.constant("test@example.com"),
      answers: fc.constant({} as Record<string, unknown>),
    });

    fc.assert(
      fc.property(emptyAnswers, (submission) => {
        const result = submitResponseSchema.safeParse(submission);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.answers).toEqual({});
        }
      }),
      { numRuns: 10 }
    );
  });
});

/**
 * Property 7: Required Field Validation
 * Validates: Requirements 4.4
 *
 * For any submission where a required field contains only whitespace characters
 * (including empty string), the validation SHALL reject the submission.
 * For any submission where all required fields contain at least one non-whitespace
 * character, the validation SHALL accept the submission.
 *
 * We test the required field validation logic as implemented in submitResponse.
 * Since the full submitResponse requires a database, we extract and test the
 * validation logic as a pure function.
 */
describe("Property 7: Required Field Validation", () => {
  /**
   * Pure function that replicates the required field validation logic
   * from src/server/actions/ppl-evaluasi/responses.ts
   */
  function validateRequiredFields(
    fields: FormField[],
    answers: Record<string, unknown>
  ): { valid: boolean; missingFields: string[] } {
    const missingFields: string[] = [];

    for (const field of fields) {
      if (!field.required) continue;

      const answer = answers[field.id];

      if (field.type === "grid") {
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
        if (!Array.isArray(answer) || answer.length === 0) {
          missingFields.push(field.label);
        }
      } else {
        if (
          answer === undefined ||
          answer === null ||
          String(answer).trim().length === 0
        ) {
          missingFields.push(field.label);
        }
      }
    }

    return { valid: missingFields.length === 0, missingFields };
  }

  // Generator for whitespace-only strings (including empty)
  const whitespaceOnly = fc.oneof(
    fc.constant(""),
    fc.constant(" "),
    fc.constant("  "),
    fc.constant("\t"),
    fc.constant("\n"),
    fc.constant(" \t\n "),
    fc.integer({ min: 1, max: 10 }).map((len) => " ".repeat(len)),
    fc.integer({ min: 1, max: 5 }).map((len) => "\t".repeat(len))
  );

  // Generator for strings with at least one non-whitespace character
  const nonWhitespaceString = fc
    .string({ minLength: 1, maxLength: 100 })
    .filter((s) => s.trim().length > 0);

  // Object prototype property names to avoid in field IDs
  const prototypeKeys = new Set(Object.getOwnPropertyNames(Object.prototype));

  // Generator for a required text/textarea/number/email field
  const requiredTextField = fc
    .tuple(
      fc.string({ minLength: 1, maxLength: 20 }).filter(
        (s) => /^[a-zA-Z0-9_]+$/.test(s) && !prototypeKeys.has(s)
      ),
      fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
      fc.constantFrom("text", "textarea", "number", "email") as fc.Arbitrary<"text" | "textarea" | "number" | "email">
    )
    .map(([id, label, type]) => ({
      id,
      type,
      label,
      required: true,
      order: 0,
      config: null,
    })) as fc.Arbitrary<FormField>;

  it("SHALL reject when a required text field contains only whitespace", () => {
    fc.assert(
      fc.property(requiredTextField, whitespaceOnly, (field, wsAnswer) => {
        const fields: FormField[] = [field];
        const answers: Record<string, unknown> = { [field.id]: wsAnswer };

        const result = validateRequiredFields(fields, answers);
        expect(result.valid).toBe(false);
        expect(result.missingFields).toContain(field.label);
      }),
      { numRuns: 200 }
    );
  });

  it("SHALL reject when a required text field is undefined or null", () => {
    fc.assert(
      fc.property(
        requiredTextField,
        fc.constantFrom(undefined, null),
        (field, emptyAnswer) => {
          const fields: FormField[] = [field];
          const answers: Record<string, unknown> = { [field.id]: emptyAnswer };

          const result = validateRequiredFields(fields, answers);
          expect(result.valid).toBe(false);
          expect(result.missingFields).toContain(field.label);
        }
      ),
      { numRuns: 50 }
    );
  });

  it("SHALL reject when a required text field is missing from answers", () => {
    fc.assert(
      fc.property(requiredTextField, (field) => {
        const fields: FormField[] = [field];
        const answers: Record<string, unknown> = {}; // field.id not present

        const result = validateRequiredFields(fields, answers);
        expect(result.valid).toBe(false);
        expect(result.missingFields).toContain(field.label);
      }),
      { numRuns: 100 }
    );
  });

  it("SHALL accept when all required text fields have non-whitespace content", () => {
    fc.assert(
      fc.property(requiredTextField, nonWhitespaceString, (field, validAnswer) => {
        const fields: FormField[] = [field];
        const answers: Record<string, unknown> = { [field.id]: validAnswer };

        const result = validateRequiredFields(fields, answers);
        expect(result.valid).toBe(true);
        expect(result.missingFields).toHaveLength(0);
      }),
      { numRuns: 200 }
    );
  });

  it("SHALL not validate optional fields (skip them)", () => {
    const optionalField = fc
      .tuple(
        fc.string({ minLength: 1, maxLength: 20 }).filter(
          (s) => /^[a-zA-Z0-9_]+$/.test(s) && !prototypeKeys.has(s)
        ),
        fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
        fc.constantFrom("text", "textarea", "number", "email") as fc.Arbitrary<"text" | "textarea" | "number" | "email">
      )
      .map(([id, label, type]) => ({
        id,
        type,
        label,
        required: false,
        order: 0,
        config: null,
      })) as fc.Arbitrary<FormField>;

    fc.assert(
      fc.property(optionalField, whitespaceOnly, (field, wsAnswer) => {
        const fields: FormField[] = [field];
        const answers: Record<string, unknown> = { [field.id]: wsAnswer };

        const result = validateRequiredFields(fields, answers);
        expect(result.valid).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("SHALL reject when a required checkbox field has empty array", () => {
    const requiredCheckboxField: FormField = {
      id: "checkbox-field",
      type: "checkbox",
      label: "Select options",
      required: true,
      order: 0,
      config: { options: ["A", "B", "C"] },
    };

    const emptyArrays = fc.constantFrom(
      [] as unknown[],
      undefined,
      null
    );

    fc.assert(
      fc.property(emptyArrays, (answer) => {
        const fields: FormField[] = [requiredCheckboxField];
        const answers: Record<string, unknown> = { [requiredCheckboxField.id]: answer };

        const result = validateRequiredFields(fields, answers);
        expect(result.valid).toBe(false);
        expect(result.missingFields).toContain(requiredCheckboxField.label);
      }),
      { numRuns: 20 }
    );
  });

  it("SHALL accept when a required checkbox field has non-empty array", () => {
    const requiredCheckboxField: FormField = {
      id: "checkbox-field",
      type: "checkbox",
      label: "Select options",
      required: true,
      order: 0,
      config: { options: ["A", "B", "C"] },
    };

    const nonEmptyArrays = fc.array(
      fc.string({ minLength: 1, maxLength: 50 }),
      { minLength: 1, maxLength: 5 }
    );

    fc.assert(
      fc.property(nonEmptyArrays, (answer) => {
        const fields: FormField[] = [requiredCheckboxField];
        const answers: Record<string, unknown> = { [requiredCheckboxField.id]: answer };

        const result = validateRequiredFields(fields, answers);
        expect(result.valid).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("SHALL reject when a required grid field has whitespace-only row values", () => {
    const requiredGridField: FormField = {
      id: "grid-field",
      type: "grid",
      label: "Rate items",
      required: true,
      order: 0,
      config: { rows: ["Row 1", "Row 2"], columns: ["1", "2", "3"] },
    };

    fc.assert(
      fc.property(whitespaceOnly, (wsValue) => {
        const fields: FormField[] = [requiredGridField];
        // Provide whitespace for at least one row
        const answers: Record<string, unknown> = {
          [requiredGridField.id]: { "0": wsValue, "1": "valid" },
        };

        const result = validateRequiredFields(fields, answers);
        expect(result.valid).toBe(false);
        expect(result.missingFields).toContain(requiredGridField.label);
      }),
      { numRuns: 100 }
    );
  });

  it("SHALL accept when a required grid field has all non-whitespace row values", () => {
    const requiredGridField: FormField = {
      id: "grid-field",
      type: "grid",
      label: "Rate items",
      required: true,
      order: 0,
      config: { rows: ["Row 1", "Row 2", "Row 3"], columns: ["1", "2", "3"] },
    };

    fc.assert(
      fc.property(
        nonWhitespaceString,
        nonWhitespaceString,
        nonWhitespaceString,
        (val1, val2, val3) => {
          const fields: FormField[] = [requiredGridField];
          const answers: Record<string, unknown> = {
            [requiredGridField.id]: { "0": val1, "1": val2, "2": val3 },
          };

          const result = validateRequiredFields(fields, answers);
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 8: Case-Insensitive Duplicate Detection
 * Validates: Requirements 4.5, 4.6
 *
 * For any two submissions to the same Kegiatan where the nama and email match
 * case-insensitively, the second submission SHALL be rejected.
 * For any two submissions where nama OR email differ (case-insensitively),
 * both SHALL be accepted.
 *
 * Since the actual duplicate detection requires a database, we test the
 * case-insensitive equality logic as a pure function.
 */
describe("Property 8: Case-Insensitive Duplicate Detection", () => {
  /**
   * Pure function that checks if two submissions are duplicates
   * based on case-insensitive nama and email comparison.
   * This replicates the logic from the SQL query:
   *   lower(nama_responden) = lower(input.namaResponden)
   *   AND lower(email_responden) = lower(input.emailResponden)
   */
  function isDuplicateSubmission(
    existing: { nama: string; email: string },
    incoming: { nama: string; email: string }
  ): boolean {
    return (
      existing.nama.toLowerCase() === incoming.nama.toLowerCase() &&
      existing.email.toLowerCase() === incoming.email.toLowerCase()
    );
  }

  // Generator for a valid name
  const validName = fc
    .string({ minLength: 1, maxLength: 200 })
    .filter((s) => s.trim().length > 0);

  // Generator for a valid email
  const validEmail = fc
    .tuple(
      fc.string({ minLength: 1, maxLength: 20 }).filter((s) => /^[a-z0-9]+$/.test(s)),
      fc.string({ minLength: 2, maxLength: 10 }).filter((s) => /^[a-z]+$/.test(s))
    )
    .map(([local, domain]) => `${local}@${domain}.com`);

  // Generator that produces a case-variant of a string
  const caseVariant = (original: fc.Arbitrary<string>) =>
    original.chain((s) =>
      fc
        .array(fc.boolean(), { minLength: s.length, maxLength: s.length })
        .map((toggles) =>
          s
            .split("")
            .map((ch, i) => (toggles[i] ? ch.toUpperCase() : ch.toLowerCase()))
            .join("")
        )
    );

  it("SHALL detect duplicates when nama and email match case-insensitively", () => {
    fc.assert(
      fc.property(validName, validEmail, (nama, email) => {
        // Create a case-variant of the same nama and email
        const existingNama = nama.toLowerCase();
        const existingEmail = email.toLowerCase();
        const incomingNama = nama.toUpperCase();
        const incomingEmail = email.toUpperCase();

        const result = isDuplicateSubmission(
          { nama: existingNama, email: existingEmail },
          { nama: incomingNama, email: incomingEmail }
        );
        expect(result).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("SHALL detect duplicates with mixed case variations", () => {
    fc.assert(
      fc.property(
        validName,
        validEmail,
        fc.array(fc.boolean(), { minLength: 1, maxLength: 200 }),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 150 }),
        (nama, email, namaToggles, emailToggles) => {
          // Apply random case toggling to create variants
          const variantNama = nama
            .split("")
            .map((ch, i) =>
              namaToggles[i % namaToggles.length]
                ? ch.toUpperCase()
                : ch.toLowerCase()
            )
            .join("");

          const variantEmail = email
            .split("")
            .map((ch, i) =>
              emailToggles[i % emailToggles.length]
                ? ch.toUpperCase()
                : ch.toLowerCase()
            )
            .join("");

          const result = isDuplicateSubmission(
            { nama, email },
            { nama: variantNama, email: variantEmail }
          );
          expect(result).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("SHALL NOT detect duplicate when nama differs case-insensitively", () => {
    fc.assert(
      fc.property(
        validName,
        validName,
        validEmail,
        (nama1, nama2, email) => {
          // Ensure the names are actually different case-insensitively
          fc.pre(nama1.toLowerCase() !== nama2.toLowerCase());

          const result = isDuplicateSubmission(
            { nama: nama1, email },
            { nama: nama2, email }
          );
          expect(result).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("SHALL NOT detect duplicate when email differs case-insensitively", () => {
    fc.assert(
      fc.property(
        validName,
        validEmail,
        validEmail,
        (nama, email1, email2) => {
          // Ensure the emails are actually different case-insensitively
          fc.pre(email1.toLowerCase() !== email2.toLowerCase());

          const result = isDuplicateSubmission(
            { nama, email: email1 },
            { nama, email: email2 }
          );
          expect(result).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("SHALL NOT detect duplicate when both nama and email differ", () => {
    fc.assert(
      fc.property(
        validName,
        validName,
        validEmail,
        validEmail,
        (nama1, nama2, email1, email2) => {
          fc.pre(
            nama1.toLowerCase() !== nama2.toLowerCase() ||
              email1.toLowerCase() !== email2.toLowerCase()
          );

          const result = isDuplicateSubmission(
            { nama: nama1, email: email1 },
            { nama: nama2, email: email2 }
          );

          // If either nama or email differs, it's not a duplicate
          if (
            nama1.toLowerCase() !== nama2.toLowerCase() ||
            email1.toLowerCase() !== email2.toLowerCase()
          ) {
            expect(result).toBe(false);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it("SHALL detect exact same strings as duplicates", () => {
    fc.assert(
      fc.property(validName, validEmail, (nama, email) => {
        const result = isDuplicateSubmission(
          { nama, email },
          { nama, email }
        );
        expect(result).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("SHALL correctly handle the submitResponseSchema validation for duplicate detection inputs", () => {
    // Verify that the schema accepts valid submissions that would be checked for duplicates
    fc.assert(
      fc.property(validName, validEmail, (nama, email) => {
        const submission = {
          namaResponden: nama,
          emailResponden: email,
          answers: { field1: "answer" },
        };

        const result = submitResponseSchema.safeParse(submission);
        expect(result.success).toBe(true);
        if (result.success) {
          // The schema preserves the original case (duplicate detection happens at DB level)
          expect(result.data.namaResponden).toBe(nama);
          expect(result.data.emailResponden).toBe(email);
        }
      }),
      { numRuns: 100 }
    );
  });
});
