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
        :background="viewerBackground"
        :theme="viewerTheme"
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

// Theme z URL parametru
const isLightMode = urlParams.get('theme') === 'light'
const viewerTheme = isLightMode ? 'light' : 'dark'
const viewerBackground = isLightMode ? 0xFFFFFF : 0x000000

// Pokud je ?url=, přeskoč upload screen
if (remoteFileUrl) {
  const fileName = remoteFileUrl.split('/').pop()?.split('?')[0] || 'vykresy.dwg'
  store.selectedFile = new File([], fileName)
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

    // === DEBUG: Hledáme přístup k Three.js scéně/rendereru ===
    if (isLightMode) {
      setTimeout(() => {
        const dm = AcApDocManager.instance as any
        console.log('=== DocManager DEBUG ===')
        console.log('dm own:', Object.getOwnPropertyNames(dm))
        console.log('dm proto:', Object.getOwnPropertyNames(Object.getPrototypeOf(dm)))
        const proto2 = Object.getPrototypeOf(Object.getPrototypeOf(dm))
        if (proto2 && proto2 !== Object.prototype) {
          console.log('dm proto2:', Object.getOwnPropertyNames(proto2))
        }

        const doc = dm.activeDocument || args.doc
        if (doc) {
          console.log('doc own:', Object.getOwnPropertyNames(doc))
          console.log('doc proto:', Object.getOwnPropertyNames(Object.getPrototypeOf(doc)))
          const docProto2 = Object.getPrototypeOf(Object.getPrototypeOf(doc))
          if (docProto2 && docProto2 !== Object.prototype) {
            console.log('doc proto2:', Object.getOwnPropertyNames(docProto2))
          }
        }

        // Zkusíme najít view/scene/renderer přímo
        for (const key of Object.getOwnPropertyNames(dm)) {
          const val = dm[key]
          if (val && typeof val === 'object' && val.constructor) {
            console.log(`dm.${key} type:`, val.constructor.name)
          }
        }
        if (doc) {
          for (const key of Object.getOwnPropertyNames(doc)) {
            const val = doc[key]
            if (val && typeof val === 'object' && val.constructor) {
              console.log(`doc.${key} type:`, val.constructor.name)
            }
          }
        }

        // Zkusíme najít Three.js scénu přes canvas
        const canvas = document.querySelector('canvas')
        if (canvas) {
          console.log('canvas found, keys:', Object.keys(canvas))
          // Check for Three.js internals
          for (const key of Object.getOwnPropertyNames(canvas)) {
            if (key.startsWith('__')) {
              console.log(`canvas.${key}:`, typeof (canvas as any)[key])
            }
          }
        }
        console.log('=== END DEBUG ===')
      }, 3000)
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
