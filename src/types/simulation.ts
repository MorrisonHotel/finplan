export interface SimulationEarlyPayment {
  amount: number
  startDate: string
  type: 'reduce-term' | 'reduce-payment'
  frequency: 'once' | 'monthly' | 'quarterly' | 'yearly'
}

export interface SimulationConfig {
  isActive: boolean
  mortgageId: string
  earlyPayment: SimulationEarlyPayment
}

export interface SimulationComparison {
  // "Было" (без досрочного)
  originalMonthlyPayment: number
  originalTotalInterest: number
  originalEndDate: string
  originalTermMonths: number

  // "Стало" (с досрочным)
  newMonthlyPayment: number
  newTotalInterest: number
  newEndDate: string
  newTermMonths: number

  // Экономия
  savedInterest: number       // рублей сэкономлено на процентах
  savedMonths: number         // месяцев сокращения срока
}
