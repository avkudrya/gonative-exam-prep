/** Only same-site, locale-free app paths are allowed as a return target after sign-in. */
export function safeReturnPath(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || value.length > 300) return null;
  return /^\/(ielts|settings|welcome)(\/[A-Za-z0-9/_-]*)?$/.test(value) ? value : null;
}

export const homePath = '/ielts/writing';
