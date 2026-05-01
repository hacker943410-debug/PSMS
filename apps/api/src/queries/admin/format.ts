export function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export function toDateOnly(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : null;
}
