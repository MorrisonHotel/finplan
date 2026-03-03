export interface Deposit {
  id: string
  name: string
  amount: number          // сумма вклада (тело)
  startDate: string       // дата открытия (ISO)
  endDate: string         // дата окончания (ISO)
  rate: number            // годовая ставка, %
  capitalization: boolean // true = проценты капитализируются ежемесячно
  autoRenewal: boolean    // автопролонгация на тот же срок
  isActive: boolean
}

export interface DepositResult {
  accruedInterest: number   // накопленные проценты на сегодня
  totalAtEnd: number        // итоговая сумма в дату окончания
  daysLeft: number          // дней до окончания
}
