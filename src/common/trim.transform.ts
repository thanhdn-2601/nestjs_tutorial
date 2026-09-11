import { Transform } from 'class-transformer';

export function TrimString() {
  return Transform(({ value }: { value: unknown }) => {
    if (value === null) return undefined;
    return typeof value === 'string' ? value.trim() : value;
  });
}

export function TrimStringArray() {
  return Transform(({ value }: { value: unknown }) => {
    if (!Array.isArray(value)) return value;
    return value
      .map((item: unknown) => (typeof item === 'string' ? item.trim() : item))
      .filter((item: unknown) => item !== '');
  });
}
