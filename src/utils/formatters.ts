const rubleFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
})

const rubleFormatterWithCents = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatMoney(amount: number, withCents = false): string {
  return withCents
    ? rubleFormatterWithCents.format(amount)
    : rubleFormatter.format(amount)
}

export function formatPercent(value: number, decimals = 2): string {
  // Убираем лишние нули: 20.00% → 20%, 4.99% → 4.99%, 8.50% → 8.5%
  return `${parseFloat(value.toFixed(decimals))}%`
}

export function formatMonths(months: number): string {
  const years = Math.floor(months / 12)
  const rem = months % 12
  const parts: string[] = []
  if (years > 0) parts.push(`${years} ${pluralize(years, 'год', 'года', 'лет')}`)
  if (rem > 0) parts.push(`${rem} ${pluralize(rem, 'мес', 'мес', 'мес')}`)
  return parts.join(' ') || '0 мес'
}

export function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100
  const mod10 = abs % 10
  if (abs > 10 && abs < 20) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}
