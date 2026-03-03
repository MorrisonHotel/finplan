import type { IncomeItem, FreelanceConfig } from '@/types/income'
import type { Mortgage } from '@/types/mortgage'
import type { FixedExpense } from '@/types/expense'
import type { Deposit } from '@/types/deposit'
import type { Goal } from '@/types/goal'
import type { SimulationConfig } from '@/types/simulation'
import { MortgageCalculatorService } from './mortgage-calculator.service'
import { DepositCalculatorService } from './deposit-calculator.service'
import { GoalTrackingService } from './goal-tracking.service'
import { SimulationService } from './simulation.service'
import { formatDate } from '@/utils/date-helpers'

export interface AdvisorSnapshot {
  incomeItems: IncomeItem[]
  freelanceConfig: FreelanceConfig
  mortgages: Mortgage[]
  fixedExpenses: FixedExpense[]
  deposits: Deposit[]
  goals: Goal[]
  simulation: SimulationConfig
  // computed
  totalIncome: number
  totalMortgagePayments: number
  totalFixedExpenses: number
  totalGoalContributions: number
  effectiveFreeBalance: number
  freelanceEarned: number
  // user context
  userPrompt?: string
}

export interface UsageInfo {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cost?: number // в USD, если OpenRouter вернул
}

export interface HealthSubMetric {
  name: string
  score: number // 1–10
}

export interface HealthCategory {
  score: number // 1–10
  label: string
  items: HealthSubMetric[]
}

export interface HealthIndex {
  overall: number // 0–100
  efficiency: HealthCategory
  risks: HealthCategory // score: 10 = риски минимальны, 1 = риски критичны
  summary: string
}

export interface AdvisorResult {
  text: string
  usage: UsageInfo | null
  healthIndex: HealthIndex | null
}

function fmt(amount: number): string {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(amount)) + ' ₽'
}

const GOAL_STATUS_LABEL: Record<string, string> = {
  'on-track': 'в графике',
  'at-risk': 'под угрозой',
  'behind': 'отстаём',
  'completed': 'выполнена',
  'no-deadline': 'без срока',
}

const FREQ_LABEL: Record<string, string> = {
  once: 'разово',
  monthly: 'ежемесячно',
  quarterly: 'ежеквартально',
  yearly: 'ежегодно',
}

const HEALTH_INDEX_PROMPT = `
В САМОМ КОНЦЕ ответа (после всех рекомендаций) добавь JSON-блок с индексом финансового здоровья, обёрнутый в теги <health_index></health_index>. Используй СТРОГО этот формат:

<health_index>
{
  "overall": <целое число 0-100, общий балл финансового здоровья>,
  "efficiency": {
    "score": <целое число 1-10>,
    "label": "<Отлично|Хорошо|Умеренно|Слабо|Критично>",
    "items": [
      { "name": "<метрика>", "score": <1-10> }
    ]
  },
  "risks": {
    "score": <целое число 1-10, где 10 = риски минимальны, 1 = риски критичны>,
    "label": "<Минимальные|Низкие|Умеренные|Высокие|Критические>",
    "items": [
      { "name": "<риск>", "score": <1-10, где 10 = этот риск минимален> }
    ]
  },
  "summary": "<1-2 предложения ключевого вывода с учётом личного контекста>"
}
</health_index>

Для Эффективности выбери 2-4 наиболее значимых метрики из: Долговая нагрузка, Прогресс по целям, Диверсификация доходов, Использование свободного баланса.
Для Рисков выбери 2-4 наиболее значимых из: Смена процентных ставок, Давление дедлайнов, Концентрация доходов, Запас прочности бюджета.
Учти личный контекст пользователя при расстановке приоритетов в оценках.`

export const AIAdvisorService = {
  buildPrompt(snap: AdvisorSnapshot): string {
    const lines: string[] = []
    const todayStr = new Date().toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    lines.push(`Дата анализа: ${todayStr}`, '')

    // ── Личный контекст ───────────────────────────────────────────────────────
    if (snap.userPrompt?.trim()) {
      lines.push(`## О пользователе (личный контекст)`)
      lines.push(snap.userPrompt.trim())
      lines.push('')
    }

    // ── Доходы ────────────────────────────────────────────────────────────────
    lines.push(`## Доходы этого месяца: ${fmt(snap.totalIncome)}`)
    for (const item of snap.incomeItems.filter((i) => i.isActive)) {
      const suffix = item.isNextMonth ? ' (придёт в следующем месяце)' : ''
      lines.push(`- ${item.name}: ${fmt(item.amount)} (${item.dayOfMonth}-го числа, категория: ${item.category}${suffix})`)
    }
    if (!snap.freelanceConfig.linkedIncomeItemId && snap.freelanceEarned > 0) {
      lines.push(
        `- Подработка (не привязана к потоку): ${fmt(snap.freelanceEarned)} ` +
        `(${snap.freelanceConfig.currentHours} ч × ${fmt(snap.freelanceConfig.hourlyRate)}/ч) ` +
        `— в итог доходов выше НЕ включена`,
      )
    }
    if (snap.freelanceConfig.linkedIncomeItemId) {
      lines.push(
        `  Фриланс-цель: ${fmt(snap.freelanceConfig.monthlyGoal)}/мес, ` +
        `отработано ${snap.freelanceConfig.currentHours} ч, ` +
        `заработано ${fmt(snap.freelanceEarned)} (включено в поток доходов)`,
      )
    }
    lines.push('')

    // ── Ипотеки (полная детализация) ─────────────────────────────────────────
    const activeMortgages = snap.mortgages.filter((m) => m.isActive)
    if (activeMortgages.length > 0) {
      lines.push(`## Ипотеки (${activeMortgages.length} шт.)`)
      lines.push(`Итого ежемесячных платежей: ${fmt(snap.totalMortgagePayments)}/мес`)
      lines.push('')

      for (const m of activeMortgages) {
        const summary = MortgageCalculatorService.getSummary(m)
        const paymentType = m.paymentType === 'annuity' ? 'аннуитетный' : 'дифференцированный'

        // Строим полный график для расчёта суммарной переплаты
        const schedule = MortgageCalculatorService.buildSchedule(m)
        const totalRemainingInterest = schedule.reduce((s, r) => s + r.interest, 0)
        const totalRemainingPayments = schedule.reduce((s, r) => s + r.payment, 0)

        lines.push(`### ${m.name}`)
        lines.push(`- Тип платежа: ${paymentType}`)
        lines.push(`- Дата выдачи: ${formatDate(m.startDate)}`)
        lines.push(`- Первоначальная сумма: ${fmt(m.initialAmount)}`)
        lines.push(`- Текущий остаток долга: ${fmt(m.currentBalance)}`)
        lines.push(`- Срок: ${m.termMonths} мес. (до ${formatDate(summary.endDate)})`)
        lines.push(`- Осталось платежей: ~${summary.remainingMonths} мес.`)
        lines.push(`- День платежа: ${m.paymentDayOfMonth}-го числа`)
        lines.push(`- Следующий платёж: ${formatDate(summary.nextPaymentDate)}`)
        lines.push(`- Текущий ежемесячный платёж: ${fmt(summary.monthlyPayment)}`)
        lines.push(`  из них: тело долга ${fmt(summary.monthlyPrincipal)}, проценты ${fmt(summary.monthlyInterest)}`)
        lines.push(`- Текущая ставка: ${summary.currentRate}%`)

        // Все периоды ставок
        const sortedPeriods = [...m.ratePeriods].sort((a, b) => a.startDate.localeCompare(b.startDate))
        if (sortedPeriods.length > 1) {
          lines.push(`- История ставок (все периоды):`)
          for (let i = 0; i < sortedPeriods.length; i++) {
            const p = sortedPeriods[i]
            const nextP = sortedPeriods[i + 1]
            const until = nextP ? `по ${formatDate(nextP.startDate)}` : 'по настоящее время и далее'
            lines.push(`  - с ${formatDate(p.startDate)} ${until}: ${p.rate}%`)
          }
        }

        // Следующая смена ставки
        if (summary.nextRateChange) {
          const nr = summary.nextRateChange
          lines.push(
            `- ⚠️  Смена ставки: с ${formatDate(nr.startDate)} → ${nr.rate}%` +
            (summary.estimatedPaymentAfterRateChange
              ? `, новый платёж ~${fmt(summary.estimatedPaymentAfterRateChange)}/мес`
              : ''),
          )
        } else {
          lines.push(`- Смена ставки: не запланирована`)
        }

        lines.push(`- Прогноз переплаты по процентам (остаток срока): ${fmt(totalRemainingInterest)}`)
        lines.push(`- Прогноз суммарных платежей (остаток срока): ${fmt(totalRemainingPayments)}`)
        lines.push('')
      }
    }

    // ── Прочие расходы ────────────────────────────────────────────────────────
    const activeExpenses = snap.fixedExpenses.filter((e) => e.isActive)
    if (activeExpenses.length > 0) {
      lines.push(`## Прочие фиксированные расходы`)
      for (const e of activeExpenses) {
        lines.push(`- ${e.name}: ${fmt(e.amount)} (категория: ${e.category}, ${e.dayOfMonth}-го числа)`)
      }
      lines.push(`Итого: ${fmt(snap.totalFixedExpenses)}/мес`, '')
    }

    // ── Свободный остаток ────────────────────────────────────────────────────
    lines.push(`## Свободный остаток (текущий месяц)`)
    lines.push(`- Доходы: +${fmt(snap.totalIncome)}`)
    lines.push(`- Ипотеки: −${fmt(snap.totalMortgagePayments)}`)
    lines.push(`- Прочие расходы: −${fmt(snap.totalFixedExpenses)}`)
    if (snap.totalGoalContributions > 0) {
      lines.push(`- Взносы по целям: −${fmt(snap.totalGoalContributions)}`)
    }
    lines.push(`- **Итого свободно: ${fmt(snap.effectiveFreeBalance)}**`)
    const loadRatio = snap.totalIncome > 0
      ? Math.round(((snap.totalMortgagePayments + snap.totalFixedExpenses) / snap.totalIncome) * 100)
      : 0
    lines.push(`- Долговая нагрузка: ${loadRatio}% от доходов`)
    lines.push('')

    // ── Вклады ────────────────────────────────────────────────────────────────
    const activeDeposits = snap.deposits.filter((d) => d.isActive)
    if (activeDeposits.length > 0) {
      lines.push(`## Вклады`)
      for (const d of activeDeposits) {
        const result = DepositCalculatorService.getResult(d)
        const cap = d.capitalization ? 'с капитализацией' : 'без капитализации'
        const renewal = d.autoRenewal ? ', автопролонгация' : ''
        lines.push(
          `- ${d.name}: ${fmt(d.amount)}, ставка ${d.rate}% (${cap}${renewal}), ` +
          `открыт ${formatDate(d.startDate)}, закрывается ${formatDate(d.endDate)}, ` +
          `к закрытию: ${fmt(result.totalAtEnd)} (доход: ${fmt(result.accruedInterest)}), ` +
          `осталось ${result.daysLeft} дн.`,
        )
      }
      lines.push('')
    }

    // ── Цели ─────────────────────────────────────────────────────────────────
    const activeGoals = snap.goals.filter((g) => g.isActive)
    if (activeGoals.length > 0) {
      lines.push(`## Финансовые цели`)
      const freeBalance = snap.effectiveFreeBalance + snap.totalGoalContributions
      const trackings = GoalTrackingService.trackAll(activeGoals, freeBalance)
      for (const t of trackings) {
        const g = t.goal
        // Привязка к ипотеке
        const linkedMortgage = g.linkedMortgageId
          ? snap.mortgages.find((m) => m.id === g.linkedMortgageId)
          : null
        const linkedStr = linkedMortgage ? `, привязана к ипотеке "${linkedMortgage.name}"` : ''

        if (g.targetAmount !== null) {
          const pct = t.progressPercent.toFixed(1)
          const deadline = g.deadline ? `, дедлайн: ${formatDate(g.deadline)}` : ''
          const monthsLeft = t.monthsToDeadline !== null ? `, осталось ${t.monthsToDeadline} мес.` : ''
          const monthly = t.requiredMonthly !== null ? `, требуется взнос: ${fmt(t.requiredMonthly)}/мес` : ''
          const available = `, доступно: ${fmt(t.monthlyAvailable)}/мес`
          const projected = t.projectedDate ? `, прогноз достижения: ${formatDate(t.projectedDate)}` : ''
          const status = GOAL_STATUS_LABEL[t.status] ?? t.status
          const contribType = g.monthlyContribution !== null
            ? `, фикс. взнос: ${fmt(g.monthlyContribution)}/мес`
            : ' (авто-взнос)'
          lines.push(
            `- **${g.name}**: цель ${fmt(g.targetAmount)}, ` +
            `накоплено ${fmt(g.currentAmount)} (${pct}%)` +
            `${deadline}${monthsLeft}${monthly}${available}${projected}${contribType}` +
            `${linkedStr}, статус: ${status}`,
          )
        } else {
          const deadline = g.deadline ? `, дедлайн: ${formatDate(g.deadline)}` : ' (без дедлайна)'
          const monthsLeft = t.monthsToDeadline !== null ? `, осталось ${t.monthsToDeadline} мес.` : ''
          const projected = t.projectedAccumulation !== null
            ? `, прогноз накопления к дедлайну: ${fmt(t.projectedAccumulation)}`
            : ''
          const available = `, доступно: ${fmt(t.monthlyAvailable)}/мес`
          lines.push(
            `- **${g.name}**: режим накопления, ` +
            `уже накоплено: ${fmt(g.currentAmount)}${deadline}${monthsLeft}${projected}${available}${linkedStr}`,
          )
        }
      }
      lines.push('')
    }

    // ── Симуляция ─────────────────────────────────────────────────────────────
    if (snap.simulation.isActive) {
      const ep = snap.simulation.earlyPayment
      const mortgage = snap.mortgages.find((m) => m.id === snap.simulation.mortgageId)
      if (mortgage) {
        try {
          const cmp = SimulationService.compare(mortgage, ep)
          const freq = FREQ_LABEL[ep.frequency] ?? ep.frequency
          const type = ep.type === 'reduce-term' ? 'уменьшение срока' : 'уменьшение платежа'
          lines.push(`## Симуляция "А что если?" (активна)`)
          lines.push(`Ипотека: ${mortgage.name}`)
          lines.push(`Сценарий: досрочный платёж ${fmt(ep.amount)} ${freq}, начиная с ${formatDate(ep.startDate)} (${type})`)
          lines.push(`Текущий итог:`)
          lines.push(`  - Срок без досрочки: ${cmp.originalTermMonths} мес., с досрочкой: ${cmp.newTermMonths} мес.`)
          lines.push(`  - Экономия на сроке: ${cmp.savedMonths} мес.`)
          lines.push(`  - Переплата без досрочки: ${fmt(cmp.originalTotalInterest)}`)
          lines.push(`  - Переплата с досрочкой: ${fmt(cmp.newTotalInterest)}`)
          lines.push(`  - **Экономия на процентах: ${fmt(cmp.savedInterest)}**`)
          lines.push('')
        } catch {
          // игнорируем ошибки симуляции
        }
      }
    }

    return lines.join('\n')
  },

  async getAdvice(snapshot: AdvisorSnapshot, apiKey: string, model: string): Promise<AdvisorResult> {
    const context = this.buildPrompt(snapshot)
    const hasUserPrompt = !!snapshot.userPrompt?.trim()

    const systemContent =
      'Ты опытный финансовый советник. Анализируй финансовые данные пользователя ' +
      'и давай конкретные, практичные рекомендации на русском языке. ' +
      'Выдели 3–5 ключевых наблюдений и советов. ' +
      'Используй Markdown для форматирования (заголовки, списки, таблицы где уместно). ' +
      'Будь кратким и по существу. Обращай внимание на риски, долговую нагрузку, ' +
      'предстоящие смены ставок и их влияние на бюджет.' +
      (hasUserPrompt ? HEALTH_INDEX_PROMPT : '')

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.origin,
        'X-Title': 'FinPlan',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: systemContent,
          },
          {
            role: 'user',
            content: `Проанализируй мою финансовую ситуацию и дай рекомендации:\n\n${context}`,
          },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(err?.error?.message ?? `HTTP ${response.status}`)
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: {
        prompt_tokens?: number
        completion_tokens?: number
        total_tokens?: number
        total_cost?: number
      }
    }

    let text = data.choices?.[0]?.message?.content ?? ''
    const usage: UsageInfo | null = data.usage
      ? {
          promptTokens: data.usage.prompt_tokens ?? 0,
          completionTokens: data.usage.completion_tokens ?? 0,
          totalTokens: data.usage.total_tokens ?? 0,
          cost: data.usage.total_cost,
        }
      : null

    // Парсим и извлекаем индекс здоровья
    let healthIndex: HealthIndex | null = null
    if (hasUserPrompt) {
      const match = text.match(/<health_index>([\s\S]*?)<\/health_index>/)
      if (match) {
        try {
          healthIndex = JSON.parse(match[1].trim()) as HealthIndex
        } catch {
          // AI вернул невалидный JSON — продолжаем без индекса
        }
        text = text.replace(/<health_index>[\s\S]*?<\/health_index>/g, '').trim()
      }
    }

    return { text, usage, healthIndex }
  },
}
