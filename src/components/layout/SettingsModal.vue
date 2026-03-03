<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAppStore } from '@/stores/app.store'

const store = useAppStore()

const modalEl = ref<HTMLElement | null>(null)
const localApiKey = ref('')
const localModel = ref('')
const localUserPrompt = ref('')
const showKey = ref(false)

onMounted(() => {
  // Инициализируем значения при каждом открытии модала
  modalEl.value?.addEventListener('show.bs.modal', () => {
    localApiKey.value = store.settings.openrouterApiKey
    localModel.value = store.settings.aiModel
    localUserPrompt.value = store.settings.userPrompt
    showKey.value = false
  })
})

function save() {
  store.updateSettings({
    openrouterApiKey: localApiKey.value.trim(),
    aiModel: localModel.value.trim() || 'anthropic/claude-opus-4',
    userPrompt: localUserPrompt.value.trim(),
  })
}

function cancel() {
  localApiKey.value = store.settings.openrouterApiKey
  localModel.value = store.settings.aiModel
  localUserPrompt.value = store.settings.userPrompt
}
</script>

<template>
  <div class="modal fade" id="settingsModal" ref="modalEl" tabindex="-1">
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title d-flex align-items-center gap-2">
            <i class="bi bi-gear text-secondary"></i>
            Настройки
          </h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" @click="cancel"></button>
        </div>

        <div class="modal-body d-flex flex-column gap-3">
          <!-- API ключ -->
          <div>
            <label class="form-label fw-semibold">OpenRouter API ключ</label>
            <div class="input-group">
              <input
                v-model="localApiKey"
                :type="showKey ? 'text' : 'password'"
                class="form-control font-monospace"
                placeholder="sk-or-..."
                autocomplete="off"
              />
              <button class="btn btn-outline-secondary" type="button" @click="showKey = !showKey">
                <i :class="showKey ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
              </button>
            </div>
            <div class="form-text text-gh-muted">
              Ключ на
              <a href="https://openrouter.ai/keys" target="_blank" rel="noopener">openrouter.ai/keys</a>.
              Хранится в localStorage.
            </div>
          </div>

          <!-- Модель -->
          <div>
            <label class="form-label fw-semibold">Модель ИИ</label>
            <input
              v-model="localModel"
              type="text"
              class="form-control font-monospace"
              placeholder="anthropic/claude-opus-4"
            />
            <div class="form-text text-gh-muted">
              Идентификатор модели OpenRouter.
              По умолчанию: <code>anthropic/claude-opus-4</code>
            </div>
          </div>

          <!-- Личный контекст -->
          <div>
            <label class="form-label fw-semibold">
              Личный контекст
              <span class="badge bg-light text-secondary ms-1" style="font-size: 10px; font-weight: 500;">Индекс здоровья</span>
            </label>
            <textarea
              v-model="localUserPrompt"
              class="form-control"
              rows="5"
              placeholder="Например: IT-специалист, 3 ипотеки. Приоритет — закрыть парковку к 2026 году. Беспокоит рост ставок по квартире А. Хочу понять, реально ли досрочно погасить одну ипотеку через 3 года..."
            ></textarea>
            <div class="form-text text-gh-muted">
              Расскажите ИИ о себе: финансовые цели, что беспокоит, на что обратить внимание.
              При заполнении ИИ формирует персональный индекс финансового здоровья.
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-sm btn-secondary" data-bs-dismiss="modal" @click="cancel">Отмена</button>
          <button class="btn btn-sm btn-primary" data-bs-dismiss="modal" @click="save">Сохранить</button>
        </div>
      </div>
    </div>
  </div>
</template>
