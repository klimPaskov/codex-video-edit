export interface Preferences {
  interfaceScale: 1 | 1.25 | 1.5;
}

export function assertPreferences(
  value: unknown,
): asserts value is Preferences {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    !Object.hasOwn(value, "interfaceScale") ||
    !("interfaceScale" in value) ||
    ![1, 1.25, 1.5].includes(value.interfaceScale as number)
  ) {
    throw new Error("Choose an interface scale of 100%, 125%, or 150%.");
  }
}
