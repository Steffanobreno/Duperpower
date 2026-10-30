import { DOG_BREEDS } from "@/lib/breeds";

/** Suggestions for breed inputs: give the input list="dog-breeds". Rendered once per page. */
export function BreedOptions({ extra = [] }: { extra?: string[] }) {
  return (
    <datalist id="dog-breeds">
      {[...extra, ...DOG_BREEDS.filter((b) => !extra.includes(b))].map((b) => (
        <option key={b} value={b} />
      ))}
    </datalist>
  );
}
