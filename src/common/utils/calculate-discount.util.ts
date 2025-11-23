export function calculateDiscount(
  subtotal: number,
  type: string,
  value: number,
  maxDiscount: number | null,
): number {
  let discount = 0;

  if (type === 'PERCENTAGE') {
    discount = (subtotal * value) / 100;
    if (maxDiscount && discount > maxDiscount) {
      discount = maxDiscount;
    }
  } else {
    discount = value;
  }

  return Math.min(discount, subtotal); // Don't discount more than subtotal
}
