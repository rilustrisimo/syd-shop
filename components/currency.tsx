export function formatPrice(amount: number): string {
  return '₱' + amount.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}
