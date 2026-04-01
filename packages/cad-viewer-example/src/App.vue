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
const isLightMode = urlParams.get('theme') !== 'dark'
const viewerTheme = isLightMode ? 'light' : 'dark'
const viewerBackground = isLightMode ? 0xFFFFFF : 0x000000

if (remoteFileUrl) {
  const fileName = remoteFileUrl.split('/').pop()?.split('?')[0] || 'vykresy.dwg'
  store.selectedFile = new File([], fileName)
}

/**
 * Konfigurace renderOrder per vrstva.
 * Záporné = vykreslí se dříve (vzadu), kladné = navrch.
 */
const LAYER_RENDER_ORDER: Record<string, number> = {
  '2D prvky - obecné': 100,       // bílé výplně – úplně vzadu
  'Výplně – Řezové': 10,          // řezové výplně vzadu
  'Výplně - Povrchové': -80,       // povrchové výplně vzadu
  'Konstrukce - svislé nosné': 0, 
  'Otvory – Dveře': 105, 
  'Otvory – Okna': 106, 
  'Otvory – Značky dveří': 107, 
  'Otvory – Značky oken': 108, 
  'Značky - detaily': 108, 
  'Značky - pohledy': 108, 
  'Značky - řezy': 108, 
  'Kóty - SP': 150,                // kóty navrch
  'Anotace - SP': 110,             // anotace navrch
}

/**
 * Oprava barev a render orderu přímo v Three.js scéně.
 * - Bílé čáry/body → černé (výplně zůstanou bílé)
 * - Render order podle LAYER_RENDER_ORDER
 */
function fixWhiteInThreeScene() {
  const dm = AcApDocManager.instance as any
  const view = dm.curView
  if (!view) return

  const scene = view.internalScene
  if (!scene) return
  const sceneWrapper = view._scene
  const layers = sceneWrapper._layers as Map<string, any>
  const layerNames = [...layers.keys()]

  // 1. Render order per vrstva
  let orderCount = 0
  for (const layoutGroup of scene.children) {
    if (!layoutGroup.children || layoutGroup.children.length !== layerNames.length) continue

    layoutGroup.children.forEach((layerGroup: any, index: number) => {
      const layerName = layerNames[index]
      if (!layerName) return

      const order = LAYER_RENDER_ORDER[layerName]
      if (order !== undefined) {
        // Nastavíme renderOrder na všechny objekty ve vrstvě
        layerGroup.renderOrder = order
        layerGroup.traverse((child: any) => {
          child.renderOrder = order
          // Pro vrstvy navrch: zajistíme že se vykreslí vždy
          if (order > 0 && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material]
            mats.forEach((m: any) => {
              if (m) m.depthTest = false
            })
          }
        })
        orderCount++
      }
    })
  }

  // 2. Bílé čáry/body → černé (Mesh přeskočíme = výplně zůstanou bílé)
  let changed = 0
  scene.traverse((obj: any) => {
    const type = obj.type || obj.constructor?.name
    if (type === 'Mesh') return

    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const mat of mats) {
        if (mat?.color && mat.color.r > 0.93 && mat.color.g > 0.93 && mat.color.b > 0.93) {
          mat.color.setHex(0x000000)
          mat.needsUpdate = true
          changed++
        }
      }
    }
  })

  console.log(`Light mode fix: ${orderCount} layers reordered, ${changed} white→black`)
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

  const hiddenLayers = ['Zóny - razítko SP']
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

    if (isLightMode) {
      setTimeout(() => fixWhiteInThreeScene(), 4000)
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
