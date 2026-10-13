export function buildWhatsAppUrl(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, '');
  const internationalNumber = digits.startsWith('51')
    ? digits
    : digits.length === 8 || digits.length === 9
      ? `51${digits}`
      : digits.length >= 10
        ? digits
        : '';

  if (internationalNumber.length < 10 || internationalNumber.length > 15) return null;
  return `https://wa.me/${internationalNumber}?text=${encodeURIComponent(message)}`;
}
