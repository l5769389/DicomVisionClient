<script setup lang="ts">
import { ref } from 'vue'
import { connectSocket } from './services/socket'
import { setApiBaseURL } from './services/api'

const backendOrigin = ref('http://127.0.0.1:8000')
const folderPath = ref('')
const message = ref('Project initialized. Ready for next step.')
const isSidebarCollapsed = ref(false)

function toggleSidebar(): void {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

function connectBackend(): void {
  connectSocket(backendOrigin.value)
  setApiBaseURL(`${backendOrigin.value}/api`)
  message.value = `Backend connected: ${backendOrigin.value}`
}

async function chooseFolder(): Promise<void> {
  const picked = await window.viewerApi?.chooseFolder?.()
  if (!picked) {
    message.value = 'Folder selection canceled.'
    return
  }

  folderPath.value = picked
  message.value = `Selected folder: ${picked}`
}
</script>

<template>
  <v-app class="app-root">
    <div class="app-shell" :class="{ 'app-shell--collapsed': isSidebarCollapsed }">
      <aside class="sidebar">
        <div class="sidebar-content">
          <div class="sidebar-header">
            <div class="brand">
              <div class="brand-mark">DV</div>
              <div v-show="!isSidebarCollapsed" class="brand-copy">
                <h1>DICOM Vision</h1>
                <p>Vue3 + Electron + Socket.IO + Axios + Vuetify</p>
              </div>
            </div>

            <v-btn
              class="sidebar-toggle"
              variant="text"
              color="primary"
              :text="isSidebarCollapsed ? '>>' : '<<'"
              @click="toggleSidebar"
            />
          </div>

          <v-card class="panel" color="transparent">
            <div v-show="!isSidebarCollapsed">
              <div class="panel-label">Backend Origin</div>
              <v-text-field
                v-model="backendOrigin"
                class="text-input"
                placeholder="http://127.0.0.1:8787"
                bg-color="rgba(10, 18, 29, 0.95)"
                color="primary"
                flat
                single-line
              />
              <v-btn class="primary-button" color="primary" @click="connectBackend">Connect Backend</v-btn>
            </div>

            <div v-show="isSidebarCollapsed" class="panel-collapsed">
              <div class="panel-label panel-label--compact">API</div>
              <v-btn class="primary-button compact-button" color="primary" @click="connectBackend">Go</v-btn>
            </div>
          </v-card>

          <v-card class="panel" color="transparent">
            <div v-show="!isSidebarCollapsed">
              <div class="panel-label">Folder Loader</div>
              <div class="panel-value">{{ folderPath || 'No folder selected' }}</div>
              <v-btn class="secondary-button" color="secondary" variant="tonal" @click="chooseFolder">
                Choose Folder
              </v-btn>
            </div>

            <div v-show="isSidebarCollapsed" class="panel-collapsed">
              <div class="panel-label panel-label--compact">DIR</div>
              <v-btn class="secondary-button compact-button" color="secondary" variant="tonal" @click="chooseFolder">
                ...
              </v-btn>
            </div>
          </v-card>
        </div>
      </aside>

      <main class="workspace">
        <header class="workspace-topbar">
          <div class="workspace-title">
            <h2>DICOM Viewer Frontend</h2>
            <p>Initialization scaffold is ready.</p>
          </div>

          <v-btn
            class="workspace-sidebar-button"
            variant="tonal"
            color="primary"
            :text="isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'"
            @click="toggleSidebar"
          />
        </header>

        <v-card class="toolbar-card" color="transparent">
          <div class="toolbar-meta">
            <span class="toolbar-title">Initialized Modules</span>
            <span class="toolbar-hint">Electron shell, Vuetify UI, Axios API, Socket.IO client</span>
          </div>
          <div class="chip-row">
            <v-chip color="primary" variant="tonal">Electron</v-chip>
            <v-chip color="primary" variant="tonal">Vue3</v-chip>
            <v-chip color="primary" variant="tonal">electron-vite</v-chip>
            <v-chip color="secondary" variant="tonal">socket.io-client</v-chip>
            <v-chip color="secondary" variant="tonal">axios</v-chip>
            <v-chip color="secondary" variant="tonal">vuetify</v-chip>
          </div>
        </v-card>

        <v-alert class="status-alert" type="info" variant="tonal">
          {{ message }}
        </v-alert>

        <section class="viewer-stage viewer-placeholder">
          <div class="placeholder-panel">
            <h3>Next Steps</h3>
            <p>1. Folder scanning and series list</p>
            <p>2. Stack / MPR / 3D viewports</p>
            <p>3. Window/level, zoom, pan, measure tools</p>
          </div>
        </section>
      </main>
    </div>
  </v-app>
</template>
