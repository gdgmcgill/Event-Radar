export interface ExperimentVariantInput {
  id: string;
  experiment_id: string;
  name: string;
  config: Record<string, unknown>;
  weight: number;
}

/**
 * FNV-1a hash for deterministic user-to-variant assignment.
 * Returns a non-negative 32-bit integer.
 */
export function fnv1aHash(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Deterministically pick a variant for a user in an experiment.
 */
export function pickVariant(
  userId: string,
  experimentId: string,
  variants: ExperimentVariantInput[]
): ExperimentVariantInput {
  const hash = fnv1aHash(`${userId}-${experimentId}`);
  const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
  const bucket = hash % totalWeight;

  let cumulative = 0;
  for (const variant of variants) {
    cumulative += variant.weight;
    if (bucket < cumulative) {
      return variant;
    }
  }

  return variants[variants.length - 1];
}

/**
 * Chi-squared test for comparing conversion rates across variants.
 */
export function chiSquaredTest(
  variantData: Array<{ conversions: number; total: number }>
): { statistic: number; pValue: number; significant: boolean } | null {
  const k = variantData.length;
  if (k < 2) return null;

  const totalConversions = variantData.reduce((s, v) => s + v.conversions, 0);
  const totalN = variantData.reduce((s, v) => s + v.total, 0);
  if (totalN === 0) return null;

  const overallRate = totalConversions / totalN;

  let chiSq = 0;
  for (const v of variantData) {
    if (v.total === 0) continue;
    const expectedConv = v.total * overallRate;
    const expectedNonConv = v.total * (1 - overallRate);
    if (expectedConv > 0) {
      chiSq += Math.pow(v.conversions - expectedConv, 2) / expectedConv;
    }
    if (expectedNonConv > 0) {
      const nonConv = v.total - v.conversions;
      chiSq += Math.pow(nonConv - expectedNonConv, 2) / expectedNonConv;
    }
  }

  const df = k - 1;
  const criticalValues: Record<number, number> = { 1: 3.841, 2: 5.991, 3: 7.815, 4: 9.488 };
  const critical = criticalValues[df] ?? 3.841 + (df - 1) * 2.0;

  const pValue = chiSq >= critical ? 0.01 : chiSq >= critical * 0.5 ? 0.1 : 0.5;

  return {
    statistic: Math.round(chiSq * 1000) / 1000,
    pValue,
    significant: chiSq >= critical,
  };
}
