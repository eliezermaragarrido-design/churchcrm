export const SMS_CONSENT_VERSION = "2026-09-17";
export const SMS_CONSENT_TEXT = "I agree to receive recurring automated text messages from First Methodist Church of Dimmitt about worship, Bible studies, church events, schedule changes, prayer updates, and ministry follow-up. Message frequency varies. Message and data rates may apply. Reply STOP to unsubscribe or HELP for help. Consent is not a condition of attendance, giving, or purchase.";

export function normalizeSmsPhone(value: string) {
  const digits = value.replace(/[\s()+.\-]/g, "");
  const national = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(national)) {
    throw new Error("Enter a valid US mobile number, including its area code.");
  }
  return `+1${national}`;
}
