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

// Theme z URL parametru
const isLightMode = urlParams.get('theme') === 'light'
const viewerTheme = isLightMode ? 'light' : 'dark'
const viewerBackground = isLightMode ? 0xFFFFFF : 0x000000

// Pokud je ?url=, přeskoč upload screen
if (remoteFileUrl) {
  const fileName = remoteFileUrl.split('/').pop()?.split('?')[0] || 'vykresy.dwg'
  store.selectedFile = new File([], fileName)
}

/**
 * Projde všechny vrstvy a přebarví bílé (true-color) na černé.
 * ACI 7 viewer invertuje automaticky, ale explicitní bílou (255,255,255) ne.
 */
function invertWhiteColors(db: any) {
  if (!isLightMode) return
  try {
    const lt = db.tables.layerTable
    const records = lt._recordsByName as Map<string, any>

    records.forEach((layer: any, name: string) => {
      try {
        const color = layer.color
        if (!color) return

        // Zkontrolujeme jestli je barva bílá (true color)
        // ACI 7 se invertuje automaticky, nechceme na něj sahat
        const ci = color.colorIndex
        if (ci === 7) return // viewer to řeší sám

        // Zjistíme RGB hodnoty
        const r = color.red ?? color.r
        const g = color.green ?? color.g
        const b = color.blue ?? color.b

        // Pokud je barva bílá nebo velmi světlá (> 240 na všech kanálech)
        if (r !== undefined && g !== undefined && b !== undefined) {
          if (r > 240 && g > 240 && b > 240) {
            console.log(`Layer "${name}": white color (${r},${g},${b}) → black`)
            // Přenastavíme na černou
            if (typeof color.setRGB === 'function') {
              color.setRGB(0, 0, 0)
            } else if (typeof color.setColor === 'function') {
              color.setColor(0, 0, 0)
            } else {
              // Přímé nastavení vlastností
              if ('red' in color) { color.red = 0; color.green = 0; color.blue = 0 }
              if ('r' in color) { color.r = 0; color.g = 0; color.b = 0 }
              // Pokusíme se nastavit colorIndex na černou (ACI 0 nebo jiný)
              if ('colorIndex' in color && ci === 7) {
                color.colorIndex = 0
              }
            }
          }
        }
      } catch (e) {
        // Ignorujeme chyby na jednotlivých vrstvách
      }
    })

    console.log(`Processed ${records.size} layers for white→black conversion`)
  } catch (e) {
    console.warn('invertWhiteColors failed:', e)
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
      invertWhiteColors(db)

      if (changed || isLightMode) {
        setTimeout(() => AcApDocManager.instance.regen(), 200)
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
