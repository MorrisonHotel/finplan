export interface RatePeriod {
  id: string
  startDate: string // ISO date
  rate: number      // годовая ставка, %
}

export interface EarlyPayment {
  id: string
  startDate: string                                          // дата первого досрочного платежа
  amount: number                                             // сумма
  type: 'reduce-term' | 'reduce-payment'                    // тип погашения
  frequency: 'once' | 'monthly' | 'quarterly' | 'yearly'   // периодичность
}

export interface Mortgage {
  id: string
  name: string
  startDate: string           // дата выдачи кредита (ISO)
  termMonths: number          // срок в месяцах
  initialAmount: number       // первоначальная сумма кредита
  currentBalance: number      // текущий остаток долга (вводится вручную)
  paymentType: 'annuity' | 'differentiated'
  paymentDayOfMonth: number   // день месяца для платежа (1–28)
  ratePeriods: RatePeriod[]   // периоды ставок, сортируются по startDate
  earlyPayments: EarlyPayment[]
  isActive: boolean
}

// Сводка по ипотеке для отображения
export interface MortgageSummary {
  currentRate: number
  remainingMonths: number
  monthlyPayment: number
  monthlyInterest: number
  monthlyPrincipal: number
  nextRateChange: RatePeriod | null
  estimatedPaymentAfterRateChange: number | null
  nextPaymentDate: string  // ISO
  endDate: string          // ISO
}

// Результат расчёта одного месяца амортизации
export interface AmortizationRow {
  date: string          // дата платежа (ISO)
  balance: number       // остаток долга ДО платежа
  payment: number       // общий платёж
  principal: number     // погашение тела
  interest: number      // погашение процентов
  balanceAfter: number  // остаток долга ПОСЛЕ платежа
  isEarlyPayment: boolean
  earlyPaymentAmount: number
}
