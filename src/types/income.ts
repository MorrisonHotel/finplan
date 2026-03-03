export type IncomeCategory = 'salary' | 'rental' | 'freelance' | 'deposit' | 'other'

export interface IncomeItem {
  id: string
  name: string
  amount: number
  dayOfMonth: number        // день месяца (1–31)
  isNextMonth: boolean      // true = деньги придут в следующем месяце
  category: IncomeCategory
  isActive: boolean
}

export interface FreelanceConfig {
  hourlyRate: number              // ставка, руб/час
  monthlyGoal: number             // цель дохода в месяц, руб
  currentHours: number            // часов отработано в этом месяце
  paymentDayOfNextMonth: number   // день выплаты в следующем месяце
  linkedIncomeItemId: string | null // ID айтема в потоке доходов (null = не привязан)
}
