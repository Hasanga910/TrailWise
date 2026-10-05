import { Check, Minus } from 'lucide-react';
import type { PackageTier } from '../../api/packages';
import { formatPrice } from '../../utils/format';
import { cn } from '../ui/cn';

export interface TierComparisonProps {
  tiers: PackageTier[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function Yes({ on, label }: { on: boolean; label: string }) {
  return on ? (
    <span className="inline-flex items-center gap-1 text-success">
      <Check className="h-4 w-4" aria-hidden /> <span className="sr-only">{label}: </span>Included
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-fg-muted">
      <Minus className="h-4 w-4" aria-hidden /> <span className="sr-only">{label}: </span>Not included
    </span>
  );
}

/** Side-by-side class comparison; each row is a radio so one tier can be picked for booking. */
export function TierComparison({ tiers, selectedId, onSelect }: TierComparisonProps) {
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface-raised shadow-soft">
      <table className="w-full text-left text-body">
        <caption className="sr-only">Compare classes: food, air conditioning and price per person</caption>
        <thead className="bg-surface-sunken text-caption text-fg-muted">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">
              Class
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Food
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              A/C
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">
              Per person
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border" role="radiogroup" aria-label="Choose your class">
          {tiers.map((tier) => {
            const selected = tier.id === selectedId;
            const id = `tier-${tier.id}`;
            return (
              <tr
                key={tier.id}
                onClick={() => onSelect(tier.id)}
                className={cn('cursor-pointer transition', selected ? 'bg-brand-soft' : 'hover:bg-surface-sunken')}
              >
                <th scope="row" className="px-4 py-3 font-semibold text-fg">
                  <label htmlFor={id} className="flex cursor-pointer items-center gap-3">
                    <input
                      id={id}
                      type="radio"
                      name="tier"
                      checked={selected}
                      onChange={() => onSelect(tier.id)}
                      className="h-4 w-4 accent-brand-700"
                    />
                    {tier.classType}
                  </label>
                </th>
                <td className="px-4 py-3">
                  <Yes on={tier.includesFood} label="Food" />
                </td>
                <td className="px-4 py-3">
                  <Yes on={tier.requiresAC} label="Air conditioning" />
                </td>
                <td className="px-4 py-3 text-right font-heading font-bold text-fg">{formatPrice(tier.basePricePerPerson)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
