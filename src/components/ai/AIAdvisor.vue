<script setup lang="ts">
import { computed, ref } from 'vue'
import { marked } from 'marked'
import { useAppStore } from '@/stores/app.store'
import { useDashboard } from '@/composables/useDashboard'
import { AIAdvisorService } from '@/services/ai-advisor.service'
import type { AdvisorSnapshot, UsageInfo, HealthIndex } from '@/services/ai-advisor.service'

const store = useAppStore()
const {
  totalIncome,
  totalMortgagePayments,
  totalFixedExpenses,
  totalGoalContributions,
  effectiveFreeBalance,
  freelanceEarned,
} = useDashboard()

const hasApiKey = computed(() => !!store.settings.openrouterApiKey)

const loading = ref(false)
const response = ref<string | null>(null)
const usage = ref<UsageInfo | null>(null)
const healthIndex = ref<HealthIndex | null>(null)
const error = ref<string | null>(null)

const renderedResponse = computed(() => {
  if (!response.value) return ''
  return marked.parse(response.value) as string
})

const usageLabel = computed(() => {
  if (!usage.value) return null
  const parts: string[] = []
  parts.push(`↑ ${usage.value.promptTokens.toLocaleString('ru')} · ↓ ${usage.value.completionTokens.toLocaleString('ru')} токенов`)
  if (usage.value.cost != null && usage.value.cost > 0) {
    parts.push(`~$${usage.value.cost.toFixed(4)}`)
  }
  return parts.join(' · ')
})

// ── Вычисляемые классы для индекса здоровья ──────────────────────────────────

const overallTextClass = computed(() => {
  if (!healthIndex.value) return ''
  const s = healthIndex.value.overall
  if (s >= 70) return 'text-success'
  if (s >= 40) return 'text-warning'
  return 'text-danger'
})

const overallBarClass = computed(() => {
  if (!healthIndex.value) return ''
  const s = healthIndex.value.overall
  if (s >= 70) return 'bg-success'
  if (s >= 40) return 'bg-warning'
  return 'bg-danger'
})

const effBadgeClass = computed(() => {
  if (!healthIndex.value) return ''
  return scoreBadgeVariant(healthIndex.value.efficiency.score)
})

const riskBadgeClass = computed(() => {
  if (!healthIndex.value) return ''
  // Для рисков: score 10 = риски минимальны = хорошо (зелёный)
  return scoreBadgeVariant(healthIndex.value.risks.score)
})

function scoreBadgeVariant(score: number): string {
  if (score >= 7) return 'bg-success'
  if (score >= 4) return 'bg-warning'
  return 'bg-danger'
}

function scoreBarVariant(score: number): string {
  if (score >= 7) return 'bg-success'
  if (score >= 4) return 'bg-warning'
  return 'bg-danger'
}

// ── Запрос к ИИ ──────────────────────────────────────────────────────────────

async function fetchAdvice() {
  loading.value = true
  error.value = null
  usage.value = null
  healthIndex.value = null

  const snapshot: AdvisorSnapshot = {
    incomeItems: store.incomeItems,
    freelanceConfig: store.freelanceConfig,
    mortgages: store.mortgages,
    fixedExpenses: store.fixedExpenses,
    deposits: store.deposits,
    goals: store.goals,
    simulation: store.simulation,
    totalIncome: totalIncome.value,
    totalMortgagePayments: totalMortgagePayments.value,
    totalFixedExpenses: totalFixedExpenses.value,
    totalGoalContributions: totalGoalContributions.value,
    effectiveFreeBalance: effectiveFreeBalance.value,
    freelanceEarned: freelanceEarned.value,
    userPrompt: store.settings.userPrompt,
  }

  try {
    const result = await AIAdvisorService.getAdvice(
      snapshot,
      store.settings.openrouterApiKey,
      store.settings.aiModel,
    )
    response.value = result.text
    usage.value = result.usage
    healthIndex.value = result.healthIndex
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Неизвестная ошибка'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="card">
    <div class="card-header d-flex align-items-center gap-2">
      <i class="bi bi-robot text-secondary"></i>
      <span class="block-title flex-grow-1">ИИ-советник</span>

      <!-- Стоимость инференса -->
      <span
        v-if="usageLabel"
        class="text-gh-muted"
        style="font-size: 11px;"
        :title="`Модель: ${store.settings.aiModel}`"
      >
        {{ usageLabel }}
      </span>

      <button
        v-if="response && !loading"
        class="btn btn-sm btn-outline-secondary"
        @click="fetchAdvice"
        title="Обновить анализ"
      >
        <i class="bi bi-arrow-clockwise"></i>
      </button>
    </div>

    <div class="card-body">
      <!-- Нет API ключа -->
      <div v-if="!hasApiKey" class="d-flex align-items-center gap-3 py-1">
        <i class="bi bi-key text-secondary" style="font-size: 24px; opacity: .4;"></i>
        <div>
          <div class="fw-semibold mb-1" style="font-size: 14px;">API-ключ не настроен</div>
          <div class="text-gh-muted" style="font-size: 13px;">
            Укажите OpenRouter API-ключ и модель в
            <button
              class="btn btn-link btn-sm p-0 align-baseline"
              style="font-size: 13px; color: inherit; text-decoration: underline;"
              data-bs-toggle="modal"
              data-bs-target="#settingsModal"
            >
              настройках <i class="bi bi-gear"></i>
            </button>,
            чтобы получить анализ от ИИ.
          </div>
        </div>
      </div>

      <!-- Ключ есть, нет ответа -->
      <div v-else-if="!response && !loading" class="d-flex align-items-center gap-3 py-1">
        <i class="bi bi-stars text-secondary" style="font-size: 24px; opacity: .5;"></i>
        <div>
          <div class="fw-semibold mb-1" style="font-size: 14px;">Готов к анализу</div>
          <button class="btn btn-sm btn-primary" @click="fetchAdvice">
            <i class="bi bi-stars me-1"></i>Получить совет от ИИ
          </button>
        </div>
      </div>

      <!-- Загрузка -->
      <div v-else-if="loading" class="d-flex align-items-center gap-3 py-1 text-gh-muted">
        <div class="spinner-border spinner-border-sm text-secondary" role="status">
          <span class="visually-hidden">Загрузка...</span>
        </div>
        <span style="font-size: 14px;">Анализирую ваши финансы...</span>
      </div>

      <!-- Ошибка -->
      <div v-if="error" class="alert alert-danger py-2 px-3 mb-0 mt-2" style="font-size: 13px;">
        <i class="bi bi-exclamation-circle me-1"></i>{{ error }}
      </div>

      <!-- Ответ: двухколоночный если есть индекс здоровья -->
      <div
        v-if="response && !loading"
        class="mt-2 d-flex gap-4 align-items-start"
      >
        <!-- Основной ответ -->
        <div class="ai-response" style="flex: 1; min-width: 0;" v-html="renderedResponse"></div>

        <!-- Индекс здоровья (25%) -->
        <div v-if="healthIndex" class="health-panel" style="width: 280px; flex-shrink: 0; border-left: 1px solid #d0d7de; padding-left: 1.25rem;">

          <!-- Заголовок -->
          <div class="fw-semibold mb-2" style="font-size: 11px; color: #57606a; text-transform: uppercase; letter-spacing: .06em;">
            Индекс здоровья
          </div>

          <!-- Общий балл -->
          <div class="text-center mb-3">
            <div :class="overallTextClass" style="font-size: 38px; font-weight: 700; line-height: 1.1;">
              {{ healthIndex.overall }}<span style="font-size: 16px; color: #57606a; font-weight: 400;">/100</span>
            </div>
            <div class="progress mt-2" style="height: 5px; border-radius: 3px;">
              <div class="progress-bar" :class="overallBarClass" :style="`width: ${healthIndex.overall}%`"></div>
            </div>
          </div>

          <!-- Эффективность -->
          <div class="mb-2">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <span style="font-size: 12px; font-weight: 600;">Эффективность</span>
              <span class="badge" :class="effBadgeClass" style="font-size: 10px;">
                {{ healthIndex.efficiency.label }} · {{ healthIndex.efficiency.score }}/10
              </span>
            </div>
            <div
              v-for="item in healthIndex.efficiency.items"
              :key="item.name"
              class="d-flex align-items-center gap-2"
              style="margin-bottom: 5px;"
            >
              <span style="font-size: 11px; color: #57606a; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                {{ item.name }}
              </span>
              <div class="progress" style="width: 52px; height: 4px; flex-shrink: 0; border-radius: 2px;">
                <div class="progress-bar" :class="scoreBarVariant(item.score)" :style="`width: ${item.score * 10}%`"></div>
              </div>
              <span style="font-size: 10px; color: #57606a; width: 26px; text-align: right; flex-shrink: 0;">{{ item.score }}/10</span>
            </div>
          </div>

          <div style="border-top: 1px solid #e6e8eb; margin: 0.6rem 0;"></div>

          <!-- Риски -->
          <div class="mb-2">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <span style="font-size: 12px; font-weight: 600;">Риски</span>
              <span class="badge" :class="riskBadgeClass" style="font-size: 10px;">
                {{ healthIndex.risks.label }} · {{ healthIndex.risks.score }}/10
              </span>
            </div>
            <div
              v-for="item in healthIndex.risks.items"
              :key="item.name"
              class="d-flex align-items-center gap-2"
              style="margin-bottom: 5px;"
            >
              <span style="font-size: 11px; color: #57606a; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                {{ item.name }}
              </span>
              <div class="progress" style="width: 52px; height: 4px; flex-shrink: 0; border-radius: 2px;">
                <div class="progress-bar" :class="scoreBarVariant(item.score)" :style="`width: ${item.score * 10}%`"></div>
              </div>
              <span style="font-size: 10px; color: #57606a; width: 26px; text-align: right; flex-shrink: 0;">{{ item.score }}/10</span>
            </div>
          </div>

          <!-- Вывод -->
          <div
            v-if="healthIndex.summary"
            style="margin-top: 0.6rem; border-top: 1px solid #e6e8eb; padding-top: 0.6rem; font-size: 11px; color: #57606a; font-style: italic; line-height: 1.55;"
          >
            {{ healthIndex.summary }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-response {
  font-size: 14px;
  line-height: 1.65;
}

/* Заголовки — разного размера */
.ai-response :deep(h1) {
  font-size: 18px;
  font-weight: 700;
  margin-top: 1.25rem;
  margin-bottom: 0.5rem;
  padding-bottom: 0.3rem;
  border-bottom: 1px solid #d0d7de;
}

.ai-response :deep(h2) {
  font-size: 15px;
  font-weight: 600;
  margin-top: 1rem;
  margin-bottom: 0.4rem;
}

.ai-response :deep(h3) {
  font-size: 13px;
  font-weight: 600;
  margin-top: 0.75rem;
  margin-bottom: 0.3rem;
  color: #57606a;
}

/* Списки */
.ai-response :deep(ul),
.ai-response :deep(ol) {
  padding-left: 1.5rem;
  margin-bottom: 0.6rem;
}

.ai-response :deep(li) {
  margin-bottom: 0.25rem;
}

/* Параграфы */
.ai-response :deep(p) {
  margin-bottom: 0.6rem;
}

/* Bold */
.ai-response :deep(strong) {
  color: #1f2328;
  font-weight: 600;
}

/* Таблицы */
.ai-response :deep(table) {
  min-width: 50%;
  border-collapse: collapse;
  margin-bottom: 1rem;
  font-size: 13px;
}

.ai-response :deep(th),
.ai-response :deep(td) {
  border: 1px solid #d0d7de;
  padding: 6px 13px;
  text-align: left;
  vertical-align: top;
}

.ai-response :deep(th) {
  background: #f6f8fa;
  font-weight: 600;
}

.ai-response :deep(tr:nth-child(even) td) {
  background: #f9fafb;
}

/* Inline code */
.ai-response :deep(code) {
  background: #f6f8fa;
  border: 1px solid #d0d7de;
  border-radius: 3px;
  font-size: 85%;
  padding: 0.1em 0.25em;
}

/* Block code — переопределяем inline-стили внутри pre */
.ai-response :deep(pre) {
  background: #f6f8fa;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  padding: 1rem;
  overflow-x: auto;
  margin-bottom: 0.75rem;
}

.ai-response :deep(pre code) {
  background: none;
  border: none;
  border-radius: 0;
  padding: 0;
  font-size: 13px;
  white-space: pre;
}

/* Горизонтальная линия */
.ai-response :deep(hr) {
  margin: 1rem 0;
  opacity: 0.15;
}

/* Blockquote */
.ai-response :deep(blockquote) {
  border-left: 3px solid #d0d7de;
  padding: 0.25rem 0.75rem;
  margin: 0 0 0.75rem;
  color: #57606a;
}
</style>
