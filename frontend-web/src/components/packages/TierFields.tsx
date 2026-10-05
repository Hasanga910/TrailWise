import type { ClassType, PackageTierInput } from '../../api/packages';
import { Checkbox } from '../ui/Checkbox';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { CLASS_TYPES } from './tierHelpers';

/** The four tier settings: class, price, food and AC. Used for new, draft and edited tiers. */
export function TierFields({ value, onChange }: { value: PackageTierInput; onChange: (patch: Partial<PackageTierInput>) => void }) {
  return (
    <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[8rem_8rem_auto_auto]">
      <Select aria-label="Class type" value={value.classType} onChange={(e) => onChange({ classType: e.target.value as ClassType })}>
        {CLASS_TYPES.map((ct) => (
          <option key={ct} value={ct}>
            {ct}
          </option>
        ))}
      </Select>
      <Input
        aria-label="Price per person"
        required
        type="number"
        min={0.01}
        step="0.01"
        placeholder="Price"
        value={value.basePricePerPerson}
        onChange={(e) => onChange({ basePricePerPerson: Number(e.target.value) })}
      />
      <Checkbox label="Food included" checked={value.includesFood} onChange={(e) => onChange({ includesFood: e.target.checked })} />
      <Checkbox label="AC required" checked={value.requiresAC} onChange={(e) => onChange({ requiresAC: e.target.checked })} />
    </div>
  );
}
