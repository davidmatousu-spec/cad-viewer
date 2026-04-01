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

const urlParams = new URLSearchParams(window.location.search)
const remoteFileUrl = urlParams.get('url')
const isLightMode = urlParams.get('theme') === 'light'
const viewerTheme = isLightMode ? 'light' : 'dark'
const viewerBackground = isLightMode ? 0xFFFFFF : 0x000000

if (remoteFileUrl) {
  const fileName = remoteFileUrl.split('/').pop()?.split('?')[0] || 'vykresy.dwg'
  store.selectedFile = new File([], fileName)
}

/**
 * Přímo v Three.js scéně přebarví bílé materiály na černé.
 * Výplně/hatche (tmavé barvy) zůstanou nedotčené.
 */
function fixWhiteInThreeScene() {
  const dm = AcApDocManager.instance as any
  const view = dm.curView
  if (!view) { console.warn('No curView'); return }

  const scene = view.internalScene
  if (!scene) { console.warn('No internalScene'); return }

  let matChanged = 0
  let vtxChanged = 0

  scene.traverse((obj: any) => {
    // 1. Opravíme materiálové barvy (bílá → černá)
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const mat of mats) {
        if (mat?.color && mat.color.r > 0.93 && mat.color.g > 0.93 && mat.color.b > 0.93) {
          mat.color.setHex(0x000000)
          mat.needsUpdate = true
          matChanged++
        }
      }
    }

    // 2. Opravíme vertex barvy v BufferGeometry (bílá → černá)
    if (obj.geometry?.attributes?.color) {
      const attr = obj.geometry.attributes.color
      const arr = attr.array
      let geomDirty = false
      for (let i = 0; i < arr.length; i += attr.itemSize) {
        const r = arr[i], g = arr[i + 1], b = arr[i + 2]
        if (r > 0.93 && g > 0.93 && b > 0.93) {
          arr[i] = 0; arr[i + 1] = 0; arr[i + 2] = 0
          geomDirty = true
          vtxChanged++
        }
      }
      if (geomDirty) attr.needsUpdate = true
    }
  })

  console.log(`Three.js fix: ${matChanged} materials, ${vtxChanged} vertices changed white→black`)

  // Vynutíme překreslení
  view._isDirty = true
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

  const hiddenLayers = ['Další vrstva', 'Ještě jedna']
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

    // Po 4s (po dorendování) opravíme bílé barvy přímo v Three.js
    if (isLightMode) {
      setTimeout(() => fixWhiteInThreeScene(), 4000)
      // Záloha pro pomalé soubory
      setTimeout(() => fixWhiteInThreeScene(), 8000)
    }
  })

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
