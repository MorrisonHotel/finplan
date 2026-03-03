export interface Goal {
  id: string
  name: string
  /** null = режим накопления (система сама считает, сколько накопим к дедлайну) */
  targetAmount: number | null
  currentAmount: number             // уже направлено/накоплено
  deadline: string | null           // дедлайн (ISO date) или null
  monthlyContribution: number | null // плановый взнос в мес (null = авто от свободного остатка)
  linkedMortgageId: string | null   // метка: для какой ипотеки цель (не влияет на расчёт)
  isActive: boolean
}

export type GoalStatus = 'on-track' | 'at-risk' | 'behind' | 'completed' | 'no-deadline'

export interface GoalTracking {
  goal: Goal
  remaining: number               // осталось до цели / до конца периода
  progressPercent: number         // % выполнения
  status: GoalStatus
  monthsToDeadline: number | null
  requiredMonthly: number | null  // сколько нужно в месяц (только режим суммы)
  projectedDate: string | null    // когда достигнем цели (только режим суммы)
  /** Режим накопления: сколько накоплю к дедлайну (currentAmount + monthly × months) */
  projectedAccumulation: number | null
  isFeasible: boolean
  monthlyAvailable: number        // реально доступно в месяц
}
