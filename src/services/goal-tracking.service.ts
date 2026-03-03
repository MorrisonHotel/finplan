import type { Goal, GoalTracking, GoalStatus } from '@/types/goal'
import { today, parseDate, monthsBetween, addMonths, toISODate, formatDate } from '@/utils/date-helpers'

export const GoalTrackingService = {

  // ─── Allocation logic ─────────────────────────────────────────────────────

  /**
   * Возвращает «требуемый» взнос для цели или null если гибкая.
   * - Manual: всегда равен monthlyContribution
   * - Savings с дедлайном + авто: remaining / monthsToDeadline
   * - Всё остальное (без дедлайна, accumulate mode): null = гибкая
   */
  _getRequired(goal: Goal): number | null {
    if (goal.monthlyContribution !== null) return goal.monthlyContribution

    if (goal.targetAmount !== null && goal.deadline) {
      const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)
      if (remaining === 0) return 0
      const months = Math.max(0, monthsBetween(today(), parseDate(goal.deadline)))
      return months > 0 ? remaining / months : 0
    }

    return null // гибкая цель
  },

  /**
   * Сумма обязательных взносов по всем активным целям.
   * Используется в useDashboard для блока "Свободный остаток".
   */
  totalRequiredContributions(goals: Goal[]): number {
    return goals
      .filter((g) => g.isActive)
      .reduce((sum, g) => {
        const req = this._getRequired(g)
        return sum + (req ?? 0)
      }, 0)
  },

  // ─── Tracking ─────────────────────────────────────────────────────────────

  trackAll(goals: Goal[], freeBalance: number): GoalTracking[] {
    const active = goals.filter((g) => g.isActive)

    // Шаг 1: обязательные взносы (цели с дедлайном / manual)
    const required = active.map((g) => this._getRequired(g))
    const totalRequired = required.reduce((s, r) => s + (r ?? 0), 0)

    // Шаг 2: портфель профинансирован если хватает на обязательные
    const portfolioFeasible = totalRequired <= freeBalance

    // Шаг 3: если денег не хватает — пропорционально сокращаем каждый взнос,
    // чтобы monthlyAvailable < requiredMonthly и UI показывал корректные цифры
    const scale = (!portfolioFeasible && totalRequired > 0)
      ? Math.max(0, freeBalance) / totalRequired
      : 1

    // Шаг 4: остаток делим поровну между гибкими целями
    // (только если портфель профинансирован, иначе гибким ничего не остаётся)
    const leftover = portfolioFeasible ? Math.max(0, freeBalance - totalRequired) : 0
    const flexibleCount = required.filter((r) => r === null).length
    const perFlexible = flexibleCount > 0 ? leftover / flexibleCount : 0

    return active.map((g, i) => {
      const allocation = required[i] !== null
        ? required[i]! * scale
        : perFlexible
      return this._track(g, allocation, portfolioFeasible)
    })
  },

  _track(goal: Goal, monthlyAllocation: number, portfolioFeasible: boolean): GoalTracking {
    const monthlyAvailable = monthlyAllocation

    let monthsToDeadline: number | null = null
    if (goal.deadline) {
      monthsToDeadline = Math.max(0, monthsBetween(today(), parseDate(goal.deadline)))
    }

    // ── Режим накопления ──────────────────────────────────────────────────────
    if (goal.targetAmount === null) {
      return this._trackAccumulate(goal, monthlyAvailable, monthsToDeadline, portfolioFeasible)
    }

    // ── Режим суммы ───────────────────────────────────────────────────────────
    return this._trackSavings(goal, goal.targetAmount, monthlyAvailable, monthsToDeadline, portfolioFeasible)
  },

  _trackSavings(
    goal: Goal,
    targetAmount: number,
    monthlyAvailable: number,
    monthsToDeadline: number | null,
    portfolioFeasible: boolean,
  ): GoalTracking {
    const remaining = Math.max(0, targetAmount - goal.currentAmount)
    const progressPercent =
      targetAmount > 0 ? Math.min(100, (goal.currentAmount / targetAmount) * 100) : 0

    if (remaining === 0) {
      return {
        goal, remaining: 0, progressPercent: 100, status: 'completed',
        monthsToDeadline: null, requiredMonthly: null, projectedDate: null,
        projectedAccumulation: null, isFeasible: true, monthlyAvailable,
      }
    }

    let requiredMonthly: number | null = null
    if (monthsToDeadline !== null && monthsToDeadline > 0) {
      requiredMonthly = remaining / monthsToDeadline
    }

    let projectedDate: string | null = null
    if (monthlyAvailable > 0) {
      const monthsNeeded = Math.ceil(remaining / monthlyAvailable)
      projectedDate = toISODate(addMonths(today(), monthsNeeded))
    }

    // Для ручного взноса — реально ли его хватает на дедлайн
    // Для авто — зависит от портфеля целей
    const isFeasible = goal.monthlyContribution !== null
      ? portfolioFeasible && monthlyAvailable >= (requiredMonthly ?? 0)
      : portfolioFeasible

    let status: GoalStatus = 'no-deadline'
    if (goal.deadline) {
      if (monthsToDeadline === 0) {
        status = 'behind'
      } else if (requiredMonthly !== null && monthlyAvailable >= requiredMonthly) {
        status = 'on-track'
      } else if (requiredMonthly !== null && monthlyAvailable >= requiredMonthly * 0.75) {
        status = 'at-risk'
      } else {
        status = 'behind'
      }
    }

    return {
      goal, remaining, progressPercent, status,
      monthsToDeadline, requiredMonthly, projectedDate,
      projectedAccumulation: null,
      isFeasible,
      monthlyAvailable,
    }
  },

  _trackAccumulate(
    goal: Goal,
    monthlyAvailable: number,
    monthsToDeadline: number | null,
    portfolioFeasible: boolean,
  ): GoalTracking {
    const isFeasible = portfolioFeasible && monthlyAvailable > 0

    if (monthsToDeadline === null) {
      return {
        goal, remaining: 0, progressPercent: 0, status: 'no-deadline',
        monthsToDeadline: null, requiredMonthly: null, projectedDate: null,
        projectedAccumulation: null, isFeasible, monthlyAvailable,
      }
    }

    const projectedAccumulation =
      goal.currentAmount + Math.max(0, monthlyAvailable) * monthsToDeadline
    const progressPercent =
      projectedAccumulation > 0
        ? Math.min(100, (goal.currentAmount / projectedAccumulation) * 100)
        : 0
    const remaining = Math.max(0, projectedAccumulation - goal.currentAmount)
    const status: GoalStatus = monthsToDeadline === 0
      ? 'completed'
      : isFeasible ? 'on-track' : 'behind'

    return {
      goal, remaining, progressPercent, status,
      monthsToDeadline, requiredMonthly: null, projectedDate: null,
      projectedAccumulation,
      isFeasible,
      monthlyAvailable,
    }
  },

  // ─── Health score ─────────────────────────────────────────────────────────

  healthScore(trackings: GoalTracking[]): { score: number; label: string; variant: string } {
    if (trackings.length === 0) return { score: 100, label: 'Нет целей', variant: 'secondary' }

    const withDeadline = trackings.filter((t) => t.goal.deadline)
    if (withDeadline.length === 0) return { score: 100, label: 'Цели без срока', variant: 'info' }

    const onTrack = withDeadline.filter(
      (t) => t.status === 'on-track' || t.status === 'completed',
    ).length
    const score = Math.round((onTrack / withDeadline.length) * 100)

    if (score >= 80) return { score, label: 'Хорошо', variant: 'success' }
    if (score >= 50) return { score, label: 'Под контролем', variant: 'warning' }
    return { score, label: 'Нужно внимание', variant: 'danger' }
  },

  formatProjectedDate(iso: string | null): string {
    if (!iso) return '—'
    return formatDate(iso)
  },
}
