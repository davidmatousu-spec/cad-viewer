<template>
  <div id="app-root">
    <div v-if="!store.selectedFile" class="upload-screen">
      <FileUpload @file-select="handleFileSelect" />
    </div>
    <div v-else>
      <MlCadViewer
        locale="en"
        :local-file="store.selectedFile"
        :mode="selectedMode"
        :background="0xFFFFFF"
        theme="light"
        @create="initialize"
        base-url="https://cdn.jsdelivr.net/gh/mlightcad/cad-data@main/"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  AcApDocManager,
  AcEdCommandStack,
  AcEdOpenMode
} from '@mlightcad/cad-simple-viewer'
import { MlCadViewer } from '@mlightcad/cad-viewer'
import { ref } from 'vue'
import { AcApQuitCmd } from './commands'
import FileUpload from './components/FileUpload.vue'
import { initializeLocale } from './locale'
import { store } from './store'

// --- AUTO-LOAD z ?url= parametru ---
const urlParams = new URLSearchParams(window.location.search)
const remoteFileUrl = urlParams.get('url')
const isLightMode = urlParams.get('theme') === 'light'

// Pokud je ?url=, přeskoč upload screen
if (remoteFileUrl) {
  const fileName = remoteFileUrl.split('/').pop()?.split('?')[0] || 'vykresy.dwg'
  store.selectedFile = new File([], fileName)
}

/**
 * Po načtení dokumentu vynutíme přeřešení ACI 7 barev
 * a prozkoumáme Three.js scénu pro úpravu bílých čar.
 */
function fixWhiteLinesForLightMode() {
  const dm = AcApDocManager.instance as any

  // 1. Zkusíme resolveAci7ForBackground - vynutí přepočet ACI 7 na černou
  try {
    console.log('Calling resolveAci7ForBackground(0xFFFFFF)...')
    const result = dm.resolveAci7ForBackground(0xFFFFFF)
    console.log('resolveAci7ForBackground result:', result)
  } catch (e) {
    console.warn('resolveAci7ForBackground failed:', e)
  }

  // 2. Zkusíme resolveColors
  try {
    console.log('Calling resolveColors...')
    if (typeof dm.resolveColors === 'function') {
      dm.resolveColors()
      console.log('resolveColors called')
    }
  } catch (e) {
    console.warn('resolveColors failed:', e)
  }

  // 3. Prozkoumáme curView a Three.js scénu
  try {
    const view = dm.curView
    if (view) {
      console.log('curView type:', view.constructor?.name)
      console.log('curView own:', Object.getOwnPropertyNames(view))
      console.log('curView proto:', Object.getOwnPropertyNames(Object.getPrototypeOf(view)))
      const proto2 = Object.getPrototypeOf(Object.getPrototypeOf(view))
      if (proto2 && proto2 !== Object.prototype) {
        console.log('curView proto2:', Object.getOwnPropertyNames(proto2))
      }
      // Hledáme scene/renderer
      for (const key of Object.getOwnPropertyNames(view)) {
        const val = view[key]
        if (val && typeof val === 'object' && val.constructor) {
          console.log(`view.${key} type:`, val.constructor.name)
        }
      }
    }
  } catch (e) {
    console.warn('curView exploration failed:', e)
  }

  // 4. Regen
  setTimeout(() => {
    AcApDocManager.instance.regen()
    console.log('regen() called after resolveAci7')
  }, 300)
}

const initialize = () => {
  initializeLocale()
  const register = AcApDocManager.instance.commandManager
  register.addCommand(
    AcEdCommandStack.SYSTEMT_COMMAND_GROUP_NAME,
    'quit', 'quit', new AcApQuitCmd()
  )
  register.addCommand(
    AcEdCommandStack.SYSTEMT_COMMAND_GROUP_NAME,
    'exit', 'exit', new AcApQuitCmd()
  )

  // Vrstvy k automatickému vypnutí
  const hiddenLayers = ['Zóny - razítko SP', 'Další vrstva', 'Ještě jedna']
  AcApDocManager.instance.events.documentActivated.addEventListener((args) => {
    try {
      const db = args.doc.database
      let changed = false
      for (const name of hiddenLayers) {
        const layer = db.tables.layerTable.getAt(name)
        if (layer) {
          layer.isOff = true
          changed = true
        }
      }
      if (changed) {
        setTimeout(() => AcApDocManager.instance.regen(), 100)
      }
    } catch (e) {
      console.warn('Auto-hide layer failed:', e)
    }

    // V light modu po 3s (po dorendování) opravíme bílé čáry
    if (isLightMode) {
      setTimeout(() => fixWhiteLinesForLightMode(), 3000)
    }
  })

  // Auto-load soubor z URL parametru
  if (remoteFileUrl) {
    void AcApDocManager.instance.openUrl(remoteFileUrl)
  }
}

const selectedMode = ref<AcEdOpenMode>(AcEdOpenMode.Read)
const handleFileSelect = (file: File, mode: AcEdOpenMode) => {
  store.selectedFile = file
  selectedMode.value = mode
}
</script>

<style scoped>
#app-root {
  height: 100vh;
  position: fixed;
}

.upload-screen {
  height: 100vh;
  width: 100vw;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  margin: 0;
  padding: 0;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1000;
  pointer-events: auto;
}
</style>
