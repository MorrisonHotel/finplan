import type { Mortgage, RatePeriod, MortgageSummary, AmortizationRow } from '@/types/mortgage'
import { today, toISODate, parseDate, addMonths, monthsBetween } from '@/utils/date-helpers'

export const MortgageCalculatorService = {
  /** Текущая применимая ставка (последний период, начавшийся до сегодня) */
  getCurrentRate(mortgage: Mortgage): number {
    const todayStr = toISODate(today())
    const applicable = mortgage.ratePeriods
      .filter((p) => p.startDate <= todayStr)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
    return applicable[0]?.rate ?? mortgage.ratePeriods[0]?.rate ?? 0
  },

  /** Следующий будущий переход ставки */
  getNextRateChange(mortgage: Mortgage): RatePeriod | null {
    const todayStr = toISODate(today())
    const future = mortgage.ratePeriods
      .filter((p) => p.startDate > todayStr)
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
    return future[0] ?? null
  },

  /** Дата окончания ипотеки */
  getEndDate(mortgage: Mortgage): Date {
    return addMonths(parseDate(mortgage.startDate), mortgage.termMonths)
  },

  /**
   * Количество оставшихся платежей.
   * Считаем от первого платежа (месяц после startDate) до следующего платежа —
   * столько уже оплачено. Остаток = termMonths - оплачено.
   * Это точнее, чем считать от today() до endDate, т.к. нет ошибки на 1–2 месяца.
   */
  getRemainingMonths(mortgage: Mortgage): number {
    const startDate = parseDate(mortgage.startDate)
    // Первый платёж — следующий месяц после выдачи, в день paymentDayOfMonth
    const firstPayment = new Date(
      startDate.getFullYear(),
      startDate.getMonth() + 1,
      mortgage.paymentDayOfMonth,
    )
    const nextPayment = this.getNextPaymentDate(mortgage)
    // Сколько платежей уже прошло (включительно до следующего, не включая его)
    const paymentsMade = Math.max(0, monthsBetween(firstPayment, nextPayment))
    return Math.max(1, mortgage.termMonths - paymentsMade)
  },

  /** Аннуитетный платёж */
  calcAnnuityPayment(balance: number, annualRate: number, months: number): number {
    if (months <= 0 || balance <= 0) return 0
    const r = annualRate / 100 / 12
    if (r === 0) return balance / months
    return (balance * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
  },

  /** Дифференцированный платёж за текущий месяц */
  calcDifferentiatedPayment(balance: number, annualRate: number, months: number): number {
    if (months <= 0 || balance <= 0) return 0
    const principal = balance / months
    const interest = (balance * annualRate) / 100 / 12
    return principal + interest
  },

  /** Ежемесячный платёж по ипотеке (с учётом типа) */
  getMonthlyPayment(mortgage: Mortgage, balance?: number, rate?: number, months?: number): number {
    const b = balance ?? mortgage.currentBalance
    const r = rate ?? this.getCurrentRate(mortgage)
    const m = months ?? this.getRemainingMonths(mortgage)
    return mortgage.paymentType === 'annuity'
      ? this.calcAnnuityPayment(b, r, m)
      : this.calcDifferentiatedPayment(b, r, m)
  },

  /** Проценты за текущий месяц */
  getMonthlyInterest(mortgage: Mortgage, balance?: number, rate?: number): number {
    const b = balance ?? mortgage.currentBalance
    const r = rate ?? this.getCurrentRate(mortgage)
    return (b * r) / 100 / 12
  },

  /** Тело платежа за текущий месяц */
  getMonthlyPrincipal(mortgage: Mortgage, balance?: number, rate?: number, months?: number): number {
    return (
      this.getMonthlyPayment(mortgage, balance, rate, months) -
      this.getMonthlyInterest(mortgage, balance, rate)
    )
  },

  /** Следующая дата платежа */
  getNextPaymentDate(mortgage: Mortgage): Date {
    const t = today()
    let d = new Date(t.getFullYear(), t.getMonth(), mortgage.paymentDayOfMonth)
    if (d <= t) d = new Date(d.getFullYear(), d.getMonth() + 1, mortgage.paymentDayOfMonth)
    return d
  },

  /**
   * Прогноз остатка долга на заданную дату.
   * Проходит по амортизационному расписанию помесячно до целевой даты.
   */
  estimateBalanceAtDate(mortgage: Mortgage, targetDate: Date): number {
    const endDate = this.getEndDate(mortgage)
    let balance = mortgage.currentBalance
    let current = today()

    while (current < targetDate && current < endDate && balance > 0) {
      const rate = this._getRateAt(mortgage, current)
      const remaining = Math.max(1, monthsBetween(current, endDate))
      const interest = (balance * rate) / 100 / 12
      const payment = this.getMonthlyPayment(mortgage, balance, rate, remaining)
      const principal = Math.min(payment - interest, balance)
      balance = Math.max(0, balance - principal)
      current = addMonths(current, 1)
    }

    return balance
  },

  /** Полная сводка для отображения в карточке */
  getSummary(mortgage: Mortgage): MortgageSummary {
    const currentRate = this.getCurrentRate(mortgage)
    const remainingMonths = this.getRemainingMonths(mortgage)
    const monthlyPayment = this.getMonthlyPayment(mortgage)
    const monthlyInterest = this.getMonthlyInterest(mortgage)
    const monthlyPrincipal = monthlyPayment - monthlyInterest
    const nextRateChange = this.getNextRateChange(mortgage)
    const nextPaymentDate = toISODate(this.getNextPaymentDate(mortgage))
    const endDate = toISODate(this.getEndDate(mortgage))

    let estimatedPaymentAfterRateChange: number | null = null
    if (nextRateChange) {
      const changeDate = parseDate(nextRateChange.startDate)
      const balanceAtChange = this.estimateBalanceAtDate(mortgage, changeDate)
      const monthsAtChange = Math.max(1, monthsBetween(changeDate, this.getEndDate(mortgage)))
      estimatedPaymentAfterRateChange = this.getMonthlyPayment(
        mortgage,
        balanceAtChange,
        nextRateChange.rate,
        monthsAtChange,
      )
    }

    return {
      currentRate,
      remainingMonths,
      monthlyPayment,
      monthlyInterest,
      monthlyPrincipal,
      nextRateChange,
      estimatedPaymentAfterRateChange,
      nextPaymentDate,
      endDate,
    }
  },

  /**
   * Полный график амортизации от currentBalance до конца.
   * Используется в симуляции и таблице платежей.
   */
  buildSchedule(mortgage: Mortgage): AmortizationRow[] {
    const rows: AmortizationRow[] = []
    const endDate = this.getEndDate(mortgage)
    let balance = mortgage.currentBalance
    let current = this.getNextPaymentDate(mortgage)

    while (balance > 0.01 && current <= endDate) {
      const rate = this._getRateAt(mortgage, current)
      const remaining = Math.max(1, monthsBetween(today(), endDate) - rows.length)
      const interest = (balance * rate) / 100 / 12
      const payment = this.getMonthlyPayment(mortgage, balance, rate, remaining)
      const principal = Math.min(payment - interest, balance)
      const balanceAfter = Math.max(0, balance - principal)

      rows.push({
        date: toISODate(current),
        balance,
        payment: principal + interest,
        principal,
        interest,
        balanceAfter,
        isEarlyPayment: false,
        earlyPaymentAmount: 0,
      })

      balance = balanceAfter
      current = addMonths(current, 1)

      if (rows.length > 600) break // защита от бесконечного цикла
    }

    return rows
  },

  /** Ставка, применимая на конкретную дату */
  _getRateAt(mortgage: Mortgage, date: Date): number {
    const dateStr = toISODate(date)
    const applicable = mortgage.ratePeriods
      .filter((p) => p.startDate <= dateStr)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
    return applicable[0]?.rate ?? mortgage.ratePeriods[0]?.rate ?? 0
  },
}
