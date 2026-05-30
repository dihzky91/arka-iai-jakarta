"use server";

import {
  getVariablesByCategory,
  getAllVariables,
  getSampleData,
} from "@/lib/email/template-engine/variable-registry";
import type { VariableCategory } from "@/lib/email/template-engine/types";

export async function getAvailableVariables(category?: string) {
  if (category && category !== "all") {
    return getVariablesByCategory(category as VariableCategory);
  }
  return getAllVariables();
}

export async function getVariableSampleData(category?: string) {
  if (category && category !== "all") {
    return getSampleData(category as VariableCategory);
  }
  const allVars = getAllVariables();
  const data: Record<string, string> = {};
  for (const v of allVars) {
    data[v.key] = v.sampleValue;
  }
  return data;
}
