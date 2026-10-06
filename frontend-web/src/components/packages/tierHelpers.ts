import type { ClassType, PackageTier, PackageTierInput } from '../../api/packages';

export const CLASS_TYPES: ClassType[] = ['Normal', 'Second', 'First'];

export function emptyTier(): PackageTierInput {
  return { classType: 'Normal', includesFood: false, basePricePerPerson: 0, requiresAC: false };
}

export function tierToInput(tier: PackageTier): PackageTierInput {
  return {
    classType: tier.classType,
    includesFood: tier.includesFood,
    basePricePerPerson: tier.basePricePerPerson,
    requiresAC: tier.requiresAC,
  };
}

export const money = (amount: number) => `$${amount.toFixed(2)}`;

/** Cheapest class first, then without food before with food. */
export function sortTiers<T extends { classType: ClassType; includesFood: boolean }>(tiers: T[]): T[] {
  return [...tiers].sort(
    (a, b) =>
      CLASS_TYPES.indexOf(a.classType) - CLASS_TYPES.indexOf(b.classType) || Number(a.includesFood) - Number(b.includesFood),
  );
}

/** True when two tiers share the same class and food option (the API refuses these with a 409). */
export function hasDuplicateTier(tiers: PackageTierInput[]): boolean {
  const seen = new Set<string>();
  for (const t of tiers) {
    const key = `${t.classType}|${t.includesFood}`;
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}
