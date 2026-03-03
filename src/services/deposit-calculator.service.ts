import type { Deposit, DepositResult } from '@/types/deposit'
import { today, parseDate, daysBetween, monthsBetween, toISODate } from '@/utils/date-helpers'

export const DepositCalculatorService = {
  /**
   * Итоговая сумма вклада на заданную дату.
   * С капитализацией: S = P × (1 + r/12)^m (m = полных месяцев)
   * Без капитализации: S = P × (1 + r/100 × days/365)
   */
  calculateTotal(deposit: Deposit, targetDate: Date): number {
    const start = parseDate(deposit.startDate)
    // Не выходим за дату окончания вклада
    const effectiveEnd = targetDate < parseDate(deposit.endDate) ? targetDate : parseDate(deposit.endDate)

    if (effectiveEnd <= start) return deposit.amount

    if (deposit.capitalization) {
      const fullMonths = monthsBetween(start, effectiveEnd)
      // Базовая сумма за полные месяцы
      const base = deposit.amount * Math.pow(1 + deposit.rate / 100 / 12, fullMonths)
      // Линейный доход за неполный текущий месяц
      const lastCapDate = new Date(start.getFullYear(), start.getMonth() + fullMonths, start.getDate())
      const partialDays = Math.max(0, daysBetween(lastCapDate, effectiveEnd))
      const daysInMonth = new Date(lastCapDate.getFullYear(), lastCapDate.getMonth() + 1, 0).getDate()
      const partial = base * (deposit.rate / 100 / 12) * (partialDays / daysInMonth)
      return base + partial
    } else {
      const days = daysBetween(start, effectiveEnd)
      return deposit.amount * (1 + (deposit.rate / 100) * (days / 365))
    }
  },

  /** Накопленные проценты на сегодня */
  getAccruedInterest(deposit: Deposit): number {
    const total = this.calculateTotal(deposit, today())
    return Math.max(0, total - deposit.amount)
  },

  /** Итоговая сумма в дату окончания */
  getTotalAtEnd(deposit: Deposit): number {
    return this.calculateTotal(deposit, parseDate(deposit.endDate))
  },

  /** Полный результат для отображения */
  getResult(deposit: Deposit): DepositResult {
    const end = parseDate(deposit.endDate)
    const t = today()
    return {
      accruedInterest: this.getAccruedInterest(deposit),
      totalAtEnd: this.getTotalAtEnd(deposit),
      daysLeft: Math.max(0, daysBetween(t, end)),
    }
  },

  /** Проверяет, заканчивается ли вклад в текущем месяце */
  maturingThisMonth(deposit: Deposit): boolean {
    const end = parseDate(deposit.endDate)
    const t = today()
    return end.getFullYear() === t.getFullYear() && end.getMonth() === t.getMonth()
  },

  /** Проверяет, заканчивается ли вклад в следующем месяце */
  maturingNextMonth(deposit: Deposit): boolean {
    const end = parseDate(deposit.endDate)
    const t = today()
    const next = new Date(t.getFullYear(), t.getMonth() + 1, 1)
    return end.getFullYear() === next.getFullYear() && end.getMonth() === next.getMonth()
  },

  /** ISO дата для следующего автопролонгирования */
  getNextRenewalDate(deposit: Deposit): string {
    const end = parseDate(deposit.endDate)
    const start = parseDate(deposit.startDate)
    const termMonths = monthsBetween(start, end)
    const next = new Date(end.getFullYear(), end.getMonth() + termMonths, end.getDate())
    return toISODate(next)
  },
}
