<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { Modal } from 'bootstrap'
import { useAppStore } from '@/stores/app.store'
import { useDashboard } from '@/composables/useDashboard'
import { GoalTrackingService } from '@/services/goal-tracking.service'
import { formatMoney, formatMonths } from '@/utils/formatters'
import { formatDate } from '@/utils/date-helpers'
import type { Goal } from '@/types/goal'
import type { GoalTracking } from '@/types/goal'
import type { Mortgage } from '@/types/mortgage'

const store = useAppStore()
const { freeBalance } = useDashboard()

const trackings = computed<GoalTracking[]>(() =>
  GoalTrackingService.trackAll(store.goals, freeBalance.value),
)

const health = computed(() => GoalTrackingService.healthScore(trackings.value))

const STATUS_CONFIG = {
  'on-track':  { icon: 'bi-check-circle-fill', cls: 'text-success', label: 'В графике' },
  'at-risk':   { icon: 'bi-exclamation-circle-fill', cls: 'text-warning', label: 'Под угрозой' },
  'behind':    { icon: 'bi-x-circle-fill', cls: 'text-danger', label: 'Отстаём' },
  'completed': { icon: 'bi-trophy-fill', cls: 'text-success', label: 'Выполнено!' },
  'no-deadline': { icon: 'bi-infinity', cls: 'text-secondary', label: 'Без срока' },
}

// ─── Modal: добавить/редактировать цель ───────────────────────────────────────

const goalModalEl = ref<HTMLElement | null>(null)
let goalModal: Modal | null = null

onMounted(() => {
  if (goalModalEl.value) goalModal = new Modal(goalModalEl.value)
})

const emptyGoal = (): Omit<Goal, 'id'> & { id?: string } => ({
  name: '',
  targetAmount: 0,
  currentAmount: 0,
  deadline: null,
  monthlyContribution: null,
  linkedMortgageId: null,
  isActive: true,
})

const goalForm = ref(emptyGoal())
const useManualContrib = ref(false)
/** true = режим накопления (targetAmount → null, система сама считает итог) */
const accumulateMode = ref(false)

function openAddGoal() {
  goalForm.value = emptyGoal()
  useManualContrib.value = false
  accumulateMode.value = false
  goalModal?.show()
}

function openEditGoal(t: GoalTracking) {
  goalForm.value = { ...t.goal, targetAmount: t.goal.targetAmount ?? 0 }
  useManualContrib.value = t.goal.monthlyContribution !== null
  accumulateMode.value = t.goal.targetAmount === null
  goalModal?.show()
}

function saveGoal() {
  if (!goalForm.value.name) return
  if (!accumulateMode.value && (!goalForm.value.targetAmount || goalForm.value.targetAmount <= 0)) return

  const data = {
    ...goalForm.value,
    targetAmount: accumulateMode.value ? null : goalForm.value.targetAmount,
    monthlyContribution: useManualContrib.value ? goalForm.value.monthlyContribution : null,
  } as Goal

  if (goalForm.value.id) {
    store.updateGoal(goalForm.value.id, data)
  } else {
    store.addGoal(data)
  }
  goalModal?.hide()
}

function removeGoal(id: string) {
  if (confirm('Удалить эту цель?')) {
    store.removeGoal(id)
    goalModal?.hide()
  }
}

// ─── Modal: обновить прогресс ─────────────────────────────────────────────────

const progressModalEl = ref<HTMLElement | null>(null)
let progressModal: Modal | null = null

onMounted(() => {
  if (progressModalEl.value) progressModal = new Modal(progressModalEl.value)
})

const progressForm = ref({ id: '', name: '', currentAmount: 0, targetAmount: 0 })

function openProgress(t: GoalTracking) {
  progressForm.value = {
    id: t.goal.id,
    name: t.goal.name,
    currentAmount: t.goal.currentAmount,
    targetAmount: t.goal.targetAmount ?? 0,
  }
  progressModal?.show()
}

function saveProgress() {
  store.updateGoal(progressForm.value.id, { currentAmount: progressForm.value.currentAmount })
  progressModal?.hide()
}

function monthsLabel(n: number | null): string {
  if (n === null) return '—'
  return formatMonths(n)
}

function mortgageName(id: string): string {
  return store.mortgages.find((m: Mortgage) => m.id === id)?.name ?? 'Ипотека'
}
</script>

<template>
  <div class="card w-100 d-flex flex-column" style="flex: 1 1 auto;">
    <!-- Header -->
    <div class="card-header d-flex align-items-center justify-content-between">
      <div class="d-flex align-items-center gap-2">
        <i class="bi bi-trophy text-warning"></i>
        <span class="block-title">Цели</span>
      </div>
      <div class="d-flex align-items-center gap-2">
        <span class="badge" :class="`bg-${health.variant}`" style="font-size: 12px;">
          {{ health.label }}
        </span>
        <button class="btn btn-sm btn-outline-secondary" @click="openAddGoal">
          <i class="bi bi-plus"></i>
        </button>
      </div>
    </div>

    <!-- Список целей -->
    <div class="card-body p-3 flex-grow-1 overflow-auto">
      <div v-if="trackings.length === 0"
        class="text-gh-muted text-center py-4" style="font-size: 13px;">
        Нет целей. Нажмите «+» чтобы добавить первую цель.
      </div>

      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem;">
        <div
          v-for="t in trackings"
          :key="t.goal.id"
          class="border rounded p-3"
          style="min-width: 0; background: #fafbfc;"
          :class="{
            'border-success': t.status === 'on-track' || t.status === 'completed',
            'border-warning': t.status === 'at-risk',
            'border-danger':  t.status === 'behind',
          }"
        >
          <!-- Строка 1: Название + бейджи + действия -->
          <div class="d-flex align-items-start justify-content-between mb-2">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <i
                :class="['bi', STATUS_CONFIG[t.status].icon, STATUS_CONFIG[t.status].cls]"
                style="font-size: 16px;"
              ></i>
              <span class="fw-semibold" style="font-size: 14px;">{{ t.goal.name }}</span>
              <span
                v-if="t.goal.linkedMortgageId"
                class="badge bg-light text-secondary"
                style="font-size: 10px;"
              >
                <i class="bi bi-bank me-1"></i>{{ mortgageName(t.goal.linkedMortgageId!) }}
              </span>
              <span
                v-if="t.goal.targetAmount === null"
                class="badge bg-info text-dark"
                style="font-size: 10px;"
              >
                <i class="bi bi-piggy-bank me-1"></i>Накопление
              </span>
            </div>
            <div class="d-flex gap-1 flex-shrink-0 ms-2">
              <button class="btn btn-sm btn-link text-gh-muted p-0" @click="openProgress(t)" title="Обновить прогресс">
                <i class="bi bi-plus-circle" style="font-size: 12px;"></i>
              </button>
              <button class="btn btn-sm btn-link text-gh-muted p-0 ms-1" @click="openEditGoal(t)">
                <i class="bi bi-pencil" style="font-size: 12px;"></i>
              </button>
            </div>
          </div>

          <!-- ═══ РЕЖИМ НАКОПЛЕНИЯ (targetAmount === null) ═══════════════════ -->
          <template v-if="t.goal.targetAmount === null">

            <!-- Главная цифра -->
            <div v-if="t.projectedAccumulation !== null" class="mb-2 p-2 rounded" style="background: #eaf3fb;">
              <div class="text-gh-muted" style="font-size: 11px;">
                К {{ formatDate(t.goal.deadline!) }} накоплю
              </div>
              <div class="fw-bold" style="font-size: 22px; color: #0969da;">
                {{ formatMoney(t.projectedAccumulation) }}
              </div>
              <div class="text-gh-muted" style="font-size: 11px;">
                Уже отложено: <strong>{{ formatMoney(t.goal.currentAmount) }}</strong> ·
                Ещё <strong>{{ monthsLabel(t.monthsToDeadline) }}</strong>
              </div>
            </div>
            <div v-else class="mb-2 text-gh-muted" style="font-size: 12px;">
              <i class="bi bi-infinity me-1"></i>Нет дедлайна — накапливаю в своём темпе
            </div>

            <!-- Прогресс-бар (накоплено от прогноза) -->
            <div v-if="t.projectedAccumulation !== null && t.projectedAccumulation > 0" class="mb-2">
              <div class="progress" style="height: 8px;">
                <div class="progress-bar bg-info" :style="{ width: t.progressPercent + '%' }"></div>
              </div>
              <div class="d-flex justify-content-between mt-1" style="font-size: 11px;">
                <span class="text-gh-muted">Накоплено {{ t.progressPercent.toFixed(0) }}%</span>
                <span class="text-gh-muted">{{ formatMoney(t.goal.currentAmount) }} / {{ formatMoney(t.projectedAccumulation) }}</span>
              </div>
            </div>

            <!-- Взнос в месяц -->
            <div class="d-flex align-items-center gap-2 mb-1" style="font-size: 12px;">
              <i class="bi bi-arrow-right-circle text-info"></i>
              <span class="text-gh-muted">Откладываю</span>
              <span class="fw-semibold">{{ formatMoney(t.monthlyAvailable) }}/мес.</span>
              <span v-if="t.goal.monthlyContribution === null" class="text-gh-muted" style="font-size: 11px;">(авто)</span>
            </div>

            <!-- Достижимость -->
            <div class="mt-2 pt-2 border-top d-flex align-items-center gap-1" style="font-size: 11px;">
              <i :class="t.isFeasible ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'" class="bi"></i>
              <span :class="t.isFeasible ? 'text-success' : 'text-danger'" class="fw-semibold">
                {{ t.isFeasible ? 'Средства есть' : 'Нет свободных средств' }}
              </span>
            </div>
          </template>

          <!-- ═══ РЕЖИМ СУММЫ (targetAmount задан) ════════════════════════════ -->
          <template v-else>

            <!-- Прогресс-бар -->
            <div class="mb-2">
              <div class="d-flex justify-content-between mb-1" style="font-size: 12px;">
                <span class="text-gh-muted">{{ formatMoney(t.goal.currentAmount) }}</span>
                <span class="fw-semibold">{{ formatMoney(t.goal.targetAmount) }}</span>
              </div>
              <div class="progress" style="height: 8px;">
                <div
                  class="progress-bar"
                  :class="{
                    'bg-success': t.status === 'on-track' || t.status === 'completed',
                    'bg-warning': t.status === 'at-risk',
                    'bg-danger': t.status === 'behind',
                    'bg-secondary': t.status === 'no-deadline',
                  }"
                  :style="{ width: t.progressPercent + '%' }"
                ></div>
              </div>
              <div class="text-end text-gh-muted mt-1" style="font-size: 11px;">
                {{ t.progressPercent.toFixed(1) }}%
              </div>
            </div>

            <!-- Метрики -->
            <div class="row g-2" style="font-size: 12px;">
              <div class="col-4">
                <div class="text-gh-muted">Осталось</div>
                <div class="fw-semibold text-danger">{{ formatMoney(t.remaining) }}</div>
              </div>

              <div v-if="t.goal.deadline" class="col-4">
                <div class="text-gh-muted">Дедлайн</div>
                <div class="fw-semibold">{{ formatDate(t.goal.deadline!) }}</div>
                <div class="text-gh-muted" style="font-size: 11px;">{{ monthsLabel(t.monthsToDeadline) }}</div>
              </div>

              <div v-if="t.requiredMonthly !== null" class="col-4">
                <div class="text-gh-muted">Нужно/мес.</div>
                <div class="fw-semibold" :class="{ 'text-danger': t.monthlyAvailable < t.requiredMonthly! }">
                  {{ formatMoney(t.requiredMonthly) }}
                </div>
              </div>

              <div v-if="t.projectedDate" class="col-4">
                <div class="text-gh-muted">Прогноз</div>
                <div class="fw-semibold">{{ formatDate(t.projectedDate) }}</div>
              </div>

              <div class="col-4">
                <div class="text-gh-muted">Взнос/мес.</div>
                <div v-if="t.goal.monthlyContribution !== null" class="fw-semibold text-primary">
                  {{ formatMoney(t.goal.monthlyContribution) }}
                </div>
                <div v-else class="fw-semibold text-secondary" style="font-size: 11px;">
                  Авто ({{ formatMoney(t.monthlyAvailable) }})
                </div>
              </div>
            </div>

            <!-- Рекомендация -->
            <div
              v-if="t.status === 'behind' && t.requiredMonthly !== null"
              class="alert alert-danger py-1 px-2 mt-2 mb-0"
              style="font-size: 12px;"
            >
              <i class="bi bi-lightning me-1"></i>
              Направьте <strong>{{ formatMoney(t.requiredMonthly) }}/мес.</strong> чтобы успеть к сроку
            </div>
            <div
              v-else-if="t.status === 'at-risk' && t.requiredMonthly !== null"
              class="alert alert-warning py-1 px-2 mt-2 mb-0"
              style="font-size: 12px;"
            >
              <i class="bi bi-exclamation-triangle me-1"></i>
              Ускорьтесь до <strong>{{ formatMoney(t.requiredMonthly) }}/мес.</strong>
            </div>

            <!-- Достижимость -->
            <div class="mt-2 pt-2 border-top d-flex align-items-start justify-content-between" style="font-size: 11px;">
              <div class="d-flex align-items-center gap-1">
                <i :class="t.isFeasible ? 'bi-check-circle-fill text-success' : 'bi-x-circle-fill text-danger'" class="bi"></i>
                <div>
                  <div :class="t.isFeasible ? 'text-success' : 'text-danger'" class="fw-semibold">
                    {{ t.isFeasible ? 'Достижима' : 'Недостижима' }}
                  </div>
                  <div class="text-gh-muted">при текущих финансах</div>
                </div>
              </div>
              <div v-if="!t.isFeasible && t.requiredMonthly !== null" class="text-end text-gh-muted">
                <div>Нужно <strong class="text-danger">{{ formatMoney(t.requiredMonthly) }}</strong>/мес.</div>
                <div>доступно <strong>{{ formatMoney(t.monthlyAvailable) }}</strong></div>
              </div>
            </div>
          </template>

        </div>
      </div>
    </div>
  </div>

  <!-- Modal: Добавить/редактировать цель -->
  <div class="modal fade" ref="goalModalEl" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">{{ goalForm.id ? 'Редактировать цель' : 'Новая цель' }}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="row g-3">
            <div class="col-12">
              <label class="form-label fw-semibold">Название</label>
              <input v-model="goalForm.name" class="form-control" placeholder="Досрочный платёж, Ремонт, Отпуск..." />
            </div>

            <!-- Режим цели -->
            <div class="col-12">
              <label class="form-label fw-semibold d-block mb-2">Тип цели</label>
              <div class="btn-group w-100" role="group">
                <input type="radio" class="btn-check" id="modeSavings" :value="false" v-model="accumulateMode" />
                <label class="btn btn-outline-secondary" for="modeSavings" style="font-size: 13px;">
                  <i class="bi bi-bullseye me-1"></i>Конкретная сумма
                </label>
                <input type="radio" class="btn-check" id="modeAccumulate" :value="true" v-model="accumulateMode" />
                <label class="btn btn-outline-secondary" for="modeAccumulate" style="font-size: 13px;">
                  <i class="bi bi-piggy-bank me-1"></i>Накопить к сроку
                </label>
              </div>
              <div class="form-text text-gh-muted mt-1">
                <template v-if="!accumulateMode">
                  Знаю точную сумму — система покажет, успею ли к сроку и хватит ли денег.
                </template>
                <template v-else>
                  Укажу дедлайн — система посчитает, сколько накоплю к этой дате при текущем доходе.
                </template>
              </div>
            </div>

            <!-- Целевая сумма (только режим суммы) -->
            <div v-if="!accumulateMode" class="col-md-6">
              <label class="form-label fw-semibold">Целевая сумма</label>
              <div class="input-group">
                <input v-model.number="goalForm.targetAmount" type="number" min="0" class="form-control" />
                <span class="input-group-text">₽</span>
              </div>
            </div>

            <div class="col-md-6">
              <label class="form-label fw-semibold">Уже накоплено</label>
              <div class="input-group">
                <input v-model.number="goalForm.currentAmount" type="number" min="0" class="form-control" />
                <span class="input-group-text">₽</span>
              </div>
            </div>

            <div class="col-12">
              <label class="form-label fw-semibold">
                {{ accumulateMode ? 'Дата платежа (когда хочу внести)' : 'Дедлайн (необязательно)' }}
              </label>
              <input
                :value="goalForm.deadline ?? ''"
                @input="goalForm.deadline = ($event.target as HTMLInputElement).value || null"
                type="date"
                class="form-control"
              />
            </div>

            <!-- Привязка к ипотеке -->
            <div class="col-12">
              <label class="form-label fw-semibold">Привязать к ипотеке (опционально)</label>
              <select v-model="goalForm.linkedMortgageId" class="form-select">
                <option :value="null">— Нет —</option>
                <option v-for="m in store.mortgages" :key="m.id" :value="m.id">
                  {{ m.name }}
                </option>
              </select>
              <div v-if="goalForm.linkedMortgageId" class="form-text text-info">
                <i class="bi bi-info-circle me-1"></i>Метка для удобства — цель отображается с названием ипотеки.
              </div>
            </div>

            <!-- Ежемесячный взнос -->
            <div class="col-12">
              <div class="form-check mb-2">
                <input v-model="useManualContrib" type="checkbox" class="form-check-input" id="manualContrib" />
                <label class="form-check-label" for="manualContrib">
                  Задать фиксированный взнос в месяц
                </label>
              </div>
              <div v-if="useManualContrib" class="input-group">
                <input v-model.number="goalForm.monthlyContribution" type="number" min="0" class="form-control"
                  placeholder="Сумма в месяц" />
                <span class="input-group-text">₽/мес.</span>
              </div>
              <div v-else class="form-text text-gh-muted">
                Авто: взнос будет рассчитан как минимум необходимый для выполнения цели в срок
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer justify-content-between">
          <button v-if="goalForm.id" class="btn btn-sm btn-outline-danger" @click="removeGoal(goalForm.id!)">
            <i class="bi bi-trash me-1"></i>Удалить
          </button>
          <div class="ms-auto d-flex gap-2">
            <button class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Отмена</button>
            <button class="btn btn-sm btn-primary" @click="saveGoal">Сохранить</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal: Обновить прогресс -->
  <div class="modal fade" ref="progressModalEl" tabindex="-1">
    <div class="modal-dialog modal-sm">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" style="font-size: 15px;">Обновить прогресс</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="text-gh-muted mb-2" style="font-size: 13px;">{{ progressForm.name }}</div>
          <label class="form-label fw-semibold">Уже накоплено</label>
          <div class="input-group">
            <input v-model.number="progressForm.currentAmount" type="number" min="0" class="form-control" />
            <span class="input-group-text">₽</span>
          </div>
          <div v-if="progressForm.targetAmount > 0" class="text-gh-muted mt-1" style="font-size: 11px;">
            Цель: {{ formatMoney(progressForm.targetAmount) }}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Отмена</button>
          <button class="btn btn-sm btn-primary" @click="saveProgress">Сохранить</button>
        </div>
      </div>
    </div>
  </div>
</template>
