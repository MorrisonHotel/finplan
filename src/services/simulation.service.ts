import type { Mortgage } from '@/types/mortgage'
import type { AmortizationRow } from '@/types/mortgage'
import type { SimulationEarlyPayment, SimulationComparison } from '@/types/simulation'
import { MortgageCalculatorService } from './mortgage-calculator.service'
import { parseDate, toISODate, addMonths, monthsBetween } from '@/utils/date-helpers'

export const SimulationService = {
  /**
   * Строит график амортизации с учётом досрочных платежей.
   *
   * reduce-term:    ежемесячный платёж фиксируется на уровне оригинального,
   *                 досрочный платёж идёт сверх него — срок сокращается.
   * reduce-payment: платёж пересчитывается каждый месяц по текущему остатку
   *                 и исходному оставшемуся сроку — платёж уменьшается.
   */
  buildSimulatedSchedule(mortgage: Mortgage, ep: SimulationEarlyPayment): AmortizationRow[] {
    const rows: AmortizationRow[] = []
    let balance = mortgage.currentBalance
    let current = MortgageCalculatorService.getNextPaymentDate(mortgage)
    const originalRemaining = MortgageCalculatorService.getRemainingMonths(mortgage)
    const epStartDate = parseDate(ep.startDate)

    // Для reduce-term фиксируем оригинальный аннуитетный платёж
    const fixedPayment =
      ep.type === 'reduce-term' ? MortgageCalculatorService.getMonthlyPayment(mortgage) : null

    for (let month = 0; balance > 0.01 && month < originalRemaining + 24; month++) {
      const rate = MortgageCalculatorService._getRateAt(mortgage, current)
      const currentRemaining = Math.max(1, originalRemaining - month)
      const interest = (balance * rate) / 100 / 12

      let regularPayment: number
      if (ep.type === 'reduce-term') {
        // Зафиксированный платёж, но не меньше начисленных процентов
        regularPayment = Math.min(fixedPayment!, balance + interest)
        regularPayment = Math.max(regularPayment, interest + 1)
      } else {
        // Пересчитываем платёж по оставшемуся сроку
        regularPayment = MortgageCalculatorService.getMonthlyPayment(
          mortgage,
          balance,
          rate,
          currentRemaining,
        )
      }

      const principal = Math.min(regularPayment - interest, balance)

      // Применяем досрочный платёж?
      let earlyAmount = 0
      if (ep.amount > 0 && current >= epStartDate) {
        const monthsFromStart = monthsBetween(epStartDate, current)
        const applies =
          ep.frequency === 'once'
            ? monthsFromStart === 0
            : ep.frequency === 'monthly'
              ? true
              : ep.frequency === 'quarterly'
                ? monthsFromStart % 3 === 0
                : ep.frequency === 'yearly'
                  ? monthsFromStart % 12 === 0
                  : false

        if (applies) {
          earlyAmount = Math.min(ep.amount, balance - principal)
        }
      }

      const balanceAfter = Math.max(0, balance - principal - earlyAmount)

      rows.push({
        date: toISODate(current),
        balance,
        payment: regularPayment + earlyAmount,
        principal,
        interest,
        balanceAfter,
        isEarlyPayment: earlyAmount > 0,
        earlyPaymentAmount: earlyAmount,
      })

      balance = balanceAfter
      current = addMonths(current, 1)
    }

    return rows
  },

  /** Сравнение: оригинал vs симуляция */
  compare(mortgage: Mortgage, ep: SimulationEarlyPayment): SimulationComparison {
    const originalSchedule = MortgageCalculatorService.buildSchedule(mortgage)
    const simulatedSchedule = this.buildSimulatedSchedule(mortgage, ep)

    const originalTotalInterest = originalSchedule.reduce((s, r) => s + r.interest, 0)
    const newTotalInterest = simulatedSchedule.reduce((s, r) => s + r.interest, 0)

    const originalEndDate = originalSchedule[originalSchedule.length - 1]?.date ?? ''
    const newEndDate = simulatedSchedule[simulatedSchedule.length - 1]?.date ?? ''

    const originalTermMonths = originalSchedule.length
    const newTermMonths = simulatedSchedule.length

    // Среднемесячный платёж (без учёта досрочных)
    const regularRows = simulatedSchedule.filter((r) => !r.isEarlyPayment)
    const newMonthlyPayment =
      regularRows.length > 0
        ? regularRows.reduce((s, r) => s + r.payment, 0) / regularRows.length
        : simulatedSchedule[0]?.payment ?? 0

    return {
      originalMonthlyPayment: originalSchedule[0]?.payment ?? 0,
      originalTotalInterest,
      originalEndDate,
      originalTermMonths,
      newMonthlyPayment,
      newTotalInterest,
      newEndDate,
      newTermMonths,
      savedInterest: originalTotalInterest - newTotalInterest,
      savedMonths: originalTermMonths - newTermMonths,
    }
  },
}
