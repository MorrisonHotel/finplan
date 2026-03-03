import { computed } from 'vue'
import { useAppStore } from '@/stores/app.store'
import { CashFlowService } from '@/services/cashflow.service'
import { MortgageCalculatorService } from '@/services/mortgage-calculator.service'
import { GoalTrackingService } from '@/services/goal-tracking.service'

/** Общие вычисления дашборда, используемые несколькими блоками */
export function useDashboard() {
  const store = useAppStore()

  /** Фактически заработано по подработке (часы × ставка) */
  const freelanceEarned = computed(() =>
    store.freelanceConfig.currentHours * store.freelanceConfig.hourlyRate,
  )

  /** Если подработка привязана к айтему потока — переопределяем его сумму */
  const freelanceOverride = computed(() =>
    store.freelanceConfig.linkedIncomeItemId
      ? { itemId: store.freelanceConfig.linkedIncomeItemId, amount: freelanceEarned.value }
      : null,
  )

  const cashFlowEntries = computed(() =>
    CashFlowService.buildEntries(store.incomeItems, store.deposits, freelanceOverride.value),
  )

  const totalIncome = computed(() => CashFlowService.totalThisMonth(cashFlowEntries.value))

  const totalMortgagePayments = computed(() =>
    store.mortgages
      .filter((m) => m.isActive)
      .reduce((sum, m) => sum + MortgageCalculatorService.getMonthlyPayment(m), 0),
  )

  const totalFixedExpenses = computed(() =>
    store.fixedExpenses
      .filter((e) => e.isActive)
      .reduce((sum, e) => sum + e.amount, 0),
  )

  const totalExpenses = computed(() => totalMortgagePayments.value + totalFixedExpenses.value)

  /** Свободный остаток до вычета взносов по целям */
  const freeBalance = computed(() => totalIncome.value - totalExpenses.value)

  /** Обязательные взносы по целям (только те, что имеют дедлайн или ручной взнос) */
  const totalGoalContributions = computed(() =>
    GoalTrackingService.totalRequiredContributions(store.goals),
  )

  /** Остаток после всех обязательств включая взносы по целям */
  const effectiveFreeBalance = computed(() => freeBalance.value - totalGoalContributions.value)

  return {
    cashFlowEntries,
    totalIncome,
    totalMortgagePayments,
    totalFixedExpenses,
    totalExpenses,
    freeBalance,
    totalGoalContributions,
    effectiveFreeBalance,
    freelanceEarned,
    freelanceOverride,
  }
}
