<template>
  <div id="app-root">
    <!-- Upload screen when no file is selected -->
    <div v-if="!store.selectedFile" class="upload-screen">
      <FileUpload @file-select="handleFileSelect" />
    </div>

    <!-- CAD viewer when file is selected -->
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

// Theme z URL parametru (?theme=light → bílé pozadí, černé čáry)
const themeParam = urlParams.get('theme')
const viewerTheme = themeParam === 'light' ? 'light' : 'dark'
const viewerBackground = themeParam === 'light' ? 0xFFFFFF : 0x000000
const isLightMode = themeParam === 'light'

// Pokud je ?url=, přeskoč upload screen
if (remoteFileUrl) {
  const fileName = remoteFileUrl.split('/').pop()?.split('?')[0] || 'vykresy.dwg'
  store.selectedFile = new File([], fileName)
}

/**
 * Přebarví bílé vrstvy na černé v light modu.
 * ACI 7 se invertuje automaticky (viewer to řeší),
 * ale explicitní true-color bílé (255,255,255) zůstanou bílé.
 */
function invertWhiteLayerColors(db: any) {
  if (!isLightMode) return
  try {
    const layerTable = db.tables.layerTable
    // Pokusíme se iterovat přes layerTable
    // layerTable by měl být iterable nebo mít forEach
    const tryIterate = (table: any) => {
      // Varianta 1: Symbol.iterator
      if (typeof table[Symbol.iterator] === 'function') {
        for (const layer of table) {
          swapWhiteColor(layer)
        }
        return true
      }
      // Varianta 2: forEach
      if (typeof table.forEach === 'function') {
        table.forEach((layer: any) => swapWhiteColor(layer))
        return true
      }
      // Varianta 3: records property
      if (table.records) {
        for (const layer of table.records) {
          swapWhiteColor(layer)
        }
        return true
      }
      return false
    }

    if (!tryIterate(layerTable)) {
      console.warn('Nelze iterovat layerTable – neznámé API')
    }
  } catch (e) {
    console.warn('invertWhiteLayerColors failed:', e)
  }
}

function swapWhiteColor(layer: any) {
  try {
    const color = layer.color
    if (!color) return

    // Zjistíme jestli je barva bílá
    const isWhite =
      // ACI color index 7 (viewer řeší automaticky, ale pro jistotu)
      color.colorIndex === 7 ||
      // Explicitní true color bílá
      (color.red === 255 && color.green === 255 && color.blue === 255) ||
      // Případně přes isForeground flag
      color.isForeground

    if (isWhite && color.colorIndex !== 7) {
      // Jen true-color bílou přebarvíme na černou
      // ACI 7 viewer invertuje sám
      if (typeof color.setRGB === 'function') {
        color.setRGB(0, 0, 0)
      } else {
        color.red = 0
        color.green = 0
        color.blue = 0
      }
    }
  } catch (e) {
    // Ignorujeme jednotlivé chyby
  }
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

      // Přebarvi bílé vrstvy na černé v light modu
      invertWhiteLayerColors(db)

      if (changed || isLightMode) {
        setTimeout(() => AcApDocManager.instance.regen(), 100)
      }
    } catch (e) {
      console.warn('Auto-hide layer failed:', e)
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
