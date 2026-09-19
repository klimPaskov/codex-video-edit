/** The only verification destination permitted for the supported ChatGPT device flow. */
export const CODEX_DEVICE_VERIFICATION_URL =
  "https://auth.openai.com/codex/device";

/** One-time login display returned only for an explicit user-initiated attempt. */
export interface DeviceLoginDetails {
  verificationUrl: typeof CODEX_DEVICE_VERIFICATION_URL;
  userCode: string;
}

export function assertDeviceLoginDetails(
  value: unknown,
): asserts value is DeviceLoginDetails {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).sort().join() !== "userCode,verificationUrl" ||
    !("verificationUrl" in value) ||
    value.verificationUrl !== CODEX_DEVICE_VERIFICATION_URL ||
    !("userCode" in value) ||
    typeof value.userCode !== "string" ||
    !/^[A-Za-z0-9-]{4,32}$/u.test(value.userCode)
  )
    throw new Error("Invalid device sign-in response.");
}
