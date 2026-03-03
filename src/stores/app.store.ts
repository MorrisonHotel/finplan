import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { StorageService } from '@/services/storage.service'
import type { Mortgage } from '@/types/mortgage'
import type { IncomeItem, FreelanceConfig } from '@/types/income'
import type { Deposit } from '@/types/deposit'
import type { FixedExpense } from '@/types/expense'
import type { Goal } from '@/types/goal'
import type { SimulationConfig } from '@/types/simulation'
import type { AppSettings } from '@/types/settings'
import { DEFAULT_SETTINGS } from '@/types/settings'

function uuid(): string {
  return crypto.randomUUID()
}

export const useAppStore = defineStore('app', () => {
  // ─── State ───────────────────────────────────────────────────────────────────

  const mortgages = ref<Mortgage[]>(StorageService.get('mortgages', []))
  const incomeItems = ref<IncomeItem[]>(StorageService.get('income_items', []))
  const freelanceConfig = ref<FreelanceConfig>(
    StorageService.get('freelance', {
      hourlyRate: 2000,
      monthlyGoal: 100_000,
      currentHours: 0,
      paymentDayOfNextMonth: 1,
      linkedIncomeItemId: null,
    }),
  )
  const deposits = ref<Deposit[]>(StorageService.get('deposits', []))
  const fixedExpenses = ref<FixedExpense[]>(StorageService.get('fixed_expenses', []))
  const goals = ref<Goal[]>(StorageService.get('goals', []))
  const simulation = ref<SimulationConfig>(
    StorageService.get('simulation', {
      isActive: false,
      mortgageId: '',
      earlyPayment: {
        amount: 0,
        startDate: new Date().toISOString().slice(0, 10),
        type: 'reduce-term',
        frequency: 'once',
      },
    }),
  )
  const settings = ref<AppSettings>(StorageService.get('settings', DEFAULT_SETTINGS))

  // ─── Persist ─────────────────────────────────────────────────────────────────

  watch(mortgages, (v) => StorageService.set('mortgages', v), { deep: true })
  watch(incomeItems, (v) => StorageService.set('income_items', v), { deep: true })
  watch(freelanceConfig, (v) => StorageService.set('freelance', v), { deep: true })
  watch(deposits, (v) => StorageService.set('deposits', v), { deep: true })
  watch(fixedExpenses, (v) => StorageService.set('fixed_expenses', v), { deep: true })
  watch(goals, (v) => StorageService.set('goals', v), { deep: true })
  watch(simulation, (v) => StorageService.set('simulation', v), { deep: true })
  watch(settings, (v) => StorageService.set('settings', v), { deep: true })

  // ─── Mortgages ────────────────────────────────────────────────────────────────

  function addMortgage(m: Omit<Mortgage, 'id'>): void {
    mortgages.value.push({ ...m, id: uuid() })
  }

  function updateMortgage(id: string, changes: Partial<Mortgage>): void {
    const idx = mortgages.value.findIndex((m) => m.id === id)
    if (idx !== -1) mortgages.value[idx] = { ...mortgages.value[idx], ...changes }
  }

  function removeMortgage(id: string): void {
    mortgages.value = mortgages.value.filter((m) => m.id !== id)
  }

  // ─── Income ───────────────────────────────────────────────────────────────────

  function addIncomeItem(item: Omit<IncomeItem, 'id'>): void {
    incomeItems.value.push({ ...item, id: uuid() })
  }

  function updateIncomeItem(id: string, changes: Partial<IncomeItem>): void {
    const idx = incomeItems.value.findIndex((i) => i.id === id)
    if (idx !== -1) incomeItems.value[idx] = { ...incomeItems.value[idx], ...changes }
  }

  function removeIncomeItem(id: string): void {
    incomeItems.value = incomeItems.value.filter((i) => i.id !== id)
  }

  function updateFreelance(changes: Partial<FreelanceConfig>): void {
    freelanceConfig.value = { ...freelanceConfig.value, ...changes }
  }

  // ─── Deposits ─────────────────────────────────────────────────────────────────

  function addDeposit(d: Omit<Deposit, 'id'>): void {
    deposits.value.push({ ...d, id: uuid() })
  }

  function updateDeposit(id: string, changes: Partial<Deposit>): void {
    const idx = deposits.value.findIndex((d) => d.id === id)
    if (idx !== -1) deposits.value[idx] = { ...deposits.value[idx], ...changes }
  }

  function removeDeposit(id: string): void {
    deposits.value = deposits.value.filter((d) => d.id !== id)
  }

  // ─── Fixed Expenses ───────────────────────────────────────────────────────────

  function addFixedExpense(e: Omit<FixedExpense, 'id'>): void {
    fixedExpenses.value.push({ ...e, id: uuid() })
  }

  function updateFixedExpense(id: string, changes: Partial<FixedExpense>): void {
    const idx = fixedExpenses.value.findIndex((e) => e.id === id)
    if (idx !== -1) fixedExpenses.value[idx] = { ...fixedExpenses.value[idx], ...changes }
  }

  function removeFixedExpense(id: string): void {
    fixedExpenses.value = fixedExpenses.value.filter((e) => e.id !== id)
  }

  // ─── Goals ────────────────────────────────────────────────────────────────────

  function addGoal(g: Omit<Goal, 'id'>): void {
    goals.value.push({ ...g, id: uuid() })
  }

  function updateGoal(id: string, changes: Partial<Goal>): void {
    const idx = goals.value.findIndex((g) => g.id === id)
    if (idx !== -1) goals.value[idx] = { ...goals.value[idx], ...changes }
  }

  function removeGoal(id: string): void {
    goals.value = goals.value.filter((g) => g.id !== id)
  }

  // ─── Simulation ───────────────────────────────────────────────────────────────

  function startSimulation(config: Omit<SimulationConfig, 'isActive'>): void {
    simulation.value = { ...config, isActive: true }
  }

  function stopSimulation(): void {
    simulation.value = { ...simulation.value, isActive: false }
  }

  function updateSimulation(changes: Partial<SimulationConfig>): void {
    simulation.value = { ...simulation.value, ...changes }
  }

  // ─── Settings ─────────────────────────────────────────────────────────────────

  function updateSettings(changes: Partial<AppSettings>): void {
    settings.value = { ...settings.value, ...changes }
  }

  // ─── Demo data (только если хранилище пустое) ─────────────────────────────────

  function initDemoData(): void {
    if (mortgages.value.length > 0) return

    mortgages.value = [
      {
        id: uuid(),
        name: 'Ипотека — Квартира А',
        startDate: '2022-03-01',
        termMonths: 240,
        initialAmount: 5_000_000,
        currentBalance: 4_200_000,
        paymentType: 'annuity',
        paymentDayOfMonth: 10,
        ratePeriods: [
          { id: uuid(), startDate: '2022-03-01', rate: 5.0 },
          { id: uuid(), startDate: '2024-03-01', rate: 20.0 },
        ],
        earlyPayments: [],
        isActive: true,
      },
      {
        id: uuid(),
        name: 'Ипотека — Квартира Б',
        startDate: '2021-06-01',
        termMonths: 180,
        initialAmount: 3_500_000,
        currentBalance: 2_800_000,
        paymentType: 'annuity',
        paymentDayOfMonth: 15,
        ratePeriods: [{ id: uuid(), startDate: '2021-06-01', rate: 8.5 }],
        earlyPayments: [],
        isActive: true,
      },
      {
        id: uuid(),
        name: 'Ипотека — Парковка',
        startDate: '2023-01-01',
        termMonths: 60,
        initialAmount: 800_000,
        currentBalance: 650_000,
        paymentType: 'annuity',
        paymentDayOfMonth: 20,
        ratePeriods: [{ id: uuid(), startDate: '2023-01-01', rate: 12.0 }],
        earlyPayments: [],
        isActive: true,
      },
    ]

    incomeItems.value = [
      {
        id: uuid(),
        name: 'Аванс',
        amount: 150_000,
        dayOfMonth: 10,
        isNextMonth: false,
        category: 'salary',
        isActive: true,
      },
      {
        id: uuid(),
        name: 'Зарплата',
        amount: 250_000,
        dayOfMonth: 25,
        isNextMonth: false,
        category: 'salary',
        isActive: true,
      },
      {
        id: uuid(),
        name: 'Аренда квартиры',
        amount: 45_000,
        dayOfMonth: 17,
        isNextMonth: false,
        category: 'rental',
        isActive: true,
      },
      {
        id: uuid(),
        name: 'Аренда парковки',
        amount: 8_000,
        dayOfMonth: 12,
        isNextMonth: false,
        category: 'rental',
        isActive: true,
      },
    ]

    fixedExpenses.value = [
      {
        id: uuid(),
        name: 'Коммунальные услуги',
        amount: 8_000,
        dayOfMonth: 10,
        category: 'utilities',
        isActive: true,
      },
      {
        id: uuid(),
        name: 'Связь и интернет',
        amount: 2_500,
        dayOfMonth: 5,
        category: 'communication',
        isActive: true,
      },
      {
        id: uuid(),
        name: 'Ежедневные расходы',
        amount: 50_000,
        dayOfMonth: 1,
        category: 'daily',
        isActive: true,
      },
    ]

    deposits.value = [
      {
        id: uuid(),
        name: 'Вклад Сбербанк',
        amount: 500_000,
        startDate: '2025-01-15',
        endDate: '2026-01-15',
        rate: 18.0,
        capitalization: true,
        autoRenewal: false,
        isActive: true,
      },
    ]

    goals.value = [
      {
        id: uuid(),
        name: 'Досрочный платёж по парковке',
        targetAmount: 200_000,
        currentAmount: 30_000,
        deadline: '2026-12-31',
        monthlyContribution: null,
        linkedMortgageId: mortgages.value[2].id,
        isActive: true,
      },
      {
        id: uuid(),
        name: 'Накопить к закрытию Сбербанка',
        targetAmount: null,
        currentAmount: 0,
        deadline: '2027-06-30',
        monthlyContribution: null,
        linkedMortgageId: mortgages.value[0].id,
        isActive: true,
      },
    ]
  }

  return {
    // State
    mortgages,
    incomeItems,
    freelanceConfig,
    deposits,
    fixedExpenses,
    goals,
    simulation,
    settings,

    // Mortgage actions
    addMortgage,
    updateMortgage,
    removeMortgage,

    // Income actions
    addIncomeItem,
    updateIncomeItem,
    removeIncomeItem,
    updateFreelance,

    // Deposit actions
    addDeposit,
    updateDeposit,
    removeDeposit,

    // Expense actions
    addFixedExpense,
    updateFixedExpense,
    removeFixedExpense,

    // Goal actions
    addGoal,
    updateGoal,
    removeGoal,

    // Simulation actions
    startSimulation,
    stopSimulation,
    updateSimulation,

    // Settings
    updateSettings,

    // Init
    initDemoData,
  }
})
