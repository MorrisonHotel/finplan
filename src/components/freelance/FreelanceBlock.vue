<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { Modal } from 'bootstrap'
import { useAppStore } from '@/stores/app.store'
import { formatMoney } from '@/utils/formatters'

const store = useAppStore()
const cfg = computed(() => store.freelanceConfig)

const earned = computed(() => cfg.value.currentHours * cfg.value.hourlyRate)
const progress = computed(() => {
  if (cfg.value.monthlyGoal <= 0) return 0
  return Math.min(100, (earned.value / cfg.value.monthlyGoal) * 100)
})
const remaining = computed(() => Math.max(0, cfg.value.monthlyGoal - earned.value))
const hoursToGoal = computed(() => {
  if (cfg.value.hourlyRate <= 0) return 0
  return Math.ceil(remaining.value / cfg.value.hourlyRate)
})

const progressClass = computed(() => {
  if (progress.value >= 100) return 'bg-success'
  if (progress.value >= 60) return 'bg-primary'
  if (progress.value >= 30) return 'bg-warning'
  return 'bg-danger'
})

// Inline редактирование часов
const editingHours = ref(false)
const hoursInput = ref(0)

function startEditHours() {
  hoursInput.value = cfg.value.currentHours
  editingHours.value = true
}

function saveHours() {
  store.updateFreelance({ currentHours: Math.max(0, hoursInput.value) })
  editingHours.value = false
}

function onHoursKey(e: KeyboardEvent) {
  if (e.key === 'Enter') saveHours()
  if (e.key === 'Escape') editingHours.value = false
}

// ─── Modal настроек ───────────────────────────────────────────────────────────

const modalEl = ref<HTMLElement | null>(null)
let modalInstance: Modal | null = null

onMounted(() => {
  if (modalEl.value) modalInstance = new Modal(modalEl.value)
})

const settingsForm = ref({
  hourlyRate: 0,
  monthlyGoal: 0,
  paymentDayOfNextMonth: 1,
  linkedIncomeItemId: null as string | null,
})

function openSettings() {
  settingsForm.value = {
    hourlyRate: cfg.value.hourlyRate,
    monthlyGoal: cfg.value.monthlyGoal,
    paymentDayOfNextMonth: cfg.value.paymentDayOfNextMonth,
    linkedIncomeItemId: cfg.value.linkedIncomeItemId,
  }
  modalInstance?.show()
}

function saveSettings() {
  store.updateFreelance(settingsForm.value)
  modalInstance?.hide()
}

const linkedItemName = computed(() => {
  if (!cfg.value.linkedIncomeItemId) return null
  return store.incomeItems.find((i) => i.id === cfg.value.linkedIncomeItemId)?.name ?? null
})
</script>

<template>
  <div class="card h-100 w-100 d-flex flex-column">
    <!-- Header -->
    <div class="card-header d-flex align-items-center justify-content-between">
      <div class="d-flex align-items-center gap-2">
        <i class="bi bi-clock text-primary"></i>
        <span class="block-title">Возможный доход</span>
      </div>
      <button class="btn btn-sm btn-link text-gh-muted p-0" @click="openSettings" title="Настройки">
        <i class="bi bi-gear"></i>
      </button>
    </div>

    <div class="card-body d-flex flex-column gap-3">
      <!-- Часы (редактируемые) -->
      <div class="text-center py-2">
        <div class="text-gh-muted mb-1" style="font-size: 11px; text-transform: uppercase; letter-spacing: .04em;">
          Отработано часов в этом месяце
        </div>
        <div class="d-flex align-items-center justify-content-center gap-2" style="height: 54px;">
          <template v-if="!editingHours">
            <span
              class="money-large"
              style="font-size: 36px; cursor: pointer; text-decoration: underline; text-decoration-style: dashed; text-underline-offset: 4px; text-decoration-color: lightgray;"
              @click="startEditHours"
              title="Нажмите чтобы изменить"
            >{{ cfg.currentHours }}</span>
            <span class="text-gh-muted" style="line-height: 1; font-size: 18px;">ч</span>
          </template>
          <template v-else>
            <input
              v-model.number="hoursInput"
              type="number"
              min="0"
              step="0.5"
              class="form-control"
              style="max-width: 100px; font-size: 20px; font-weight: 700;"
              @keydown="onHoursKey"
              @blur="saveHours"
              ref="hoursInputEl"
            />
            <span class="text-gh-muted">ч</span>
            <button class="btn btn-sm btn-primary" @click="saveHours">
              <i class="bi bi-check"></i>
            </button>
          </template>
        </div>
      </div>

      <!-- Заработано -->
      <div>
        <div class="d-flex justify-content-between align-items-baseline mb-1">
          <span class="text-gh-muted" style="font-size: 12px;">Заработано</span>
          <span class="fw-bold money-positive">{{ formatMoney(earned) }}</span>
        </div>
        <div class="d-flex justify-content-between align-items-baseline mb-2">
          <span class="text-gh-muted" style="font-size: 12px;">Цель</span>
          <span class="fw-semibold">{{ formatMoney(cfg.monthlyGoal) }}</span>
        </div>

        <!-- Прогресс-бар -->
        <div class="progress mb-1" style="height: 10px; border-radius: 5px;">
          <div
            class="progress-bar"
            :class="progressClass"
            :style="{ width: progress + '%' }"
            style="transition: width 0.4s ease; border-radius: 5px;"
          ></div>
        </div>
        <div class="d-flex justify-content-between" style="font-size: 11px;">
          <span class="text-gh-muted">{{ progress.toFixed(0) }}%</span>
          <span v-if="progress < 100" class="text-gh-muted">
            Осталось: {{ formatMoney(remaining) }} ({{ hoursToGoal }} ч)
          </span>
          <span v-else class="text-success fw-semibold">Цель достигнута!</span>
        </div>
      </div>

      <!-- Ставка и привязка -->
      <div class="d-flex justify-content-between align-items-center" style="font-size: 12px;">
        <span class="text-gh-muted">Ставка: <strong class="text-body">{{ formatMoney(cfg.hourlyRate) }}/час</strong></span>
        <span v-if="linkedItemName" class="d-flex align-items-center gap-1">
          <i class="bi bi-link-45deg text-primary"></i>
          <span class="text-primary fw-semibold">{{ linkedItemName }}</span>
        </span>
        <span v-else class="text-gh-muted">
          <i class="bi bi-link me-1"></i>Не привязан
        </span>
      </div>

    </div>

    <!-- Footer: дата и сумма выплаты -->
    <div class="card-footer p-3" style="background: #f6f8fa;">
      <div class="d-flex justify-content-between align-items-center">
        <span class="text-gh-muted" style="font-size: 12px;">
          <i class="bi bi-calendar-check me-1"></i>Выплата {{ cfg.paymentDayOfNextMonth }}-го следующего месяца
        </span>
        <span class="money-positive fw-bold" style="font-size: 15px;">{{ formatMoney(earned) }}</span>
      </div>
    </div>
  </div>

  <!-- Modal настроек подработки -->
  <div class="modal fade" ref="modalEl" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Настройки подработки</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
        </div>
        <div class="modal-body">
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label fw-semibold">Ставка (₽/час)</label>
              <div class="input-group">
                <input v-model.number="settingsForm.hourlyRate" type="number" min="0" class="form-control" />
                <span class="input-group-text">₽/ч</span>
              </div>
            </div>
            <div class="col-md-6">
              <label class="form-label fw-semibold">Цель на месяц</label>
              <div class="input-group">
                <input v-model.number="settingsForm.monthlyGoal" type="number" min="0" class="form-control" />
                <span class="input-group-text">₽</span>
              </div>
            </div>
            <div class="col-12">
              <label class="form-label fw-semibold">День выплаты (следующего месяца)</label>
              <input v-model.number="settingsForm.paymentDayOfNextMonth" type="number" min="1" max="31" class="form-control" />
            </div>
            <div class="col-12">
              <label class="form-label fw-semibold">Привязать к источнику дохода</label>
              <select v-model="settingsForm.linkedIncomeItemId" class="form-select">
                <option :value="null">— Не привязан —</option>
                <option
                  v-for="item in store.incomeItems.filter(i => i.isActive)"
                  :key="item.id"
                  :value="item.id"
                >
                  {{ item.name }}
                </option>
              </select>
              <div class="form-text text-gh-muted">
                Если привязан — сумма айтема в потоке доходов будет равна часы × ставка.
                Это повлияет на итог этого месяца и свободный остаток.
              </div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-sm btn-secondary" data-bs-dismiss="modal">Отмена</button>
          <button class="btn btn-sm btn-primary" @click="saveSettings">Сохранить</button>
        </div>
      </div>
    </div>
  </div>
</template>
