export type ExpenseCategory = 'utilities' | 'communication' | 'daily' | 'other'

export interface FixedExpense {
  id: string
  name: string
  amount: number
  dayOfMonth: number
  category: ExpenseCategory
  isActive: boolean
}
