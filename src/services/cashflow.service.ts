import type { IncomeItem } from '@/types/income'
import type { Deposit } from '@/types/deposit'
import { DepositCalculatorService } from './deposit-calculator.service'
import { today, parseDate, toISODate } from '@/utils/date-helpers'

export interface CashFlowEntry {
  id: string
  dayOfMonth: number
  name: string
  amount: number
  category: string
  isNextMonth: boolean   // деньги придут в следующем месяце
  isDeposit: boolean     // источник — вклад
  isFreelance: boolean
}

export const CashFlowService = {
  /**
   * Собирает все записи потока на текущий месяц:
   * - обычные доходы (incomeItems)
   * - вклады, заканчивающиеся в текущем или следующем месяце
   *
   * @param earnedOverride — если задан, переопределяет сумму указанного айтема
   *   фактически заработанной (из FreelanceBlock)
   */
  buildEntries(
    incomeItems: IncomeItem[],
    deposits: Deposit[],
    earnedOverride: { itemId: string; amount: number } | null = null,
  ): CashFlowEntry[] {
    const entries: CashFlowEntry[] = []

    // Обычные доходы
    for (const item of incomeItems) {
      if (!item.isActive) continue
      const amount =
        earnedOverride && item.id === earnedOverride.itemId
          ? earnedOverride.amount
          : item.amount
      entries.push({
        id: item.id,
        dayOfMonth: item.dayOfMonth,
        name: item.name,
        amount,
        category: item.category,
        isNextMonth: item.isNextMonth,
        isDeposit: false,
        isFreelance: item.category === 'freelance',
      })
    }

    // Вклады, заканчивающиеся в этом месяце
    for (const d of deposits) {
      if (!d.isActive) continue
      if (DepositCalculatorService.maturingThisMonth(d)) {
        const total = DepositCalculatorService.getTotalAtEnd(d)
        const end = parseDate(d.endDate)
        entries.push({
          id: `deposit-${d.id}`,
          dayOfMonth: end.getDate(),
          name: `${d.name} (вклад)`,
          amount: total,
          category: 'deposit',
          isNextMonth: false,
          isDeposit: true,
          isFreelance: false,
        })
      }
    }

    // Сортировка: сначала текущего месяца по дате, потом следующего месяца
    return entries.sort((a, b) => {
      if (a.isNextMonth !== b.isNextMonth) return a.isNextMonth ? 1 : -1
      return a.dayOfMonth - b.dayOfMonth
    })
  },

  /** Итого поступлений в ЭТОМ месяце (без "следующего") */
  totalThisMonth(entries: CashFlowEntry[]): number {
    return entries
      .filter((e) => !e.isNextMonth)
      .reduce((sum, e) => sum + e.amount, 0)
  },

  /** Итого поступлений в СЛЕДУЮЩЕМ месяце (подработка и т.п.) */
  totalNextMonth(entries: CashFlowEntry[]): number {
    return entries
      .filter((e) => e.isNextMonth)
      .reduce((sum, e) => sum + e.amount, 0)
  },

  /** Форматирует день месяца как метку */
  dayLabel(day: number): string {
    const t = today()
    const d = new Date(t.getFullYear(), t.getMonth(), day)
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  },

  /** Прошёл ли уже этот день в текущем месяце */
  isPast(day: number): boolean {
    return day < today().getDate()
  },

  /** Сегодня ли */
  isToday(day: number): boolean {
    return day === today().getDate()
  },
}
