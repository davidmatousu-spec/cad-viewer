import {
  AcCmColor,
  AcDbDatabase,
  AcDbSystemVariables,
  AcDbSysVarManager
} from '@mlightcad/data-model'

/** Returns the current measurement overlay color from the MEASUREMENTCOLOR system variable. */
export function measurementColor(db: AcDbDatabase): AcCmColor {
  return AcDbSysVarManager.instance().getVar(
    AcDbSystemVariables.MEASUREMENTCOLOR,
    db
  ) as AcCmColor
}

/** Converts an AcCmColor to a CSS rgba() string. */
export function colorToCssAlpha(c: AcCmColor, alpha: number): string {
  return `rgba(${c.red}, ${c.green}, ${c.blue}, ${alpha})`
}

/** Returns the CSS color string for a measurement color, with fallback. */
export function cssColor(c: AcCmColor): string {
  return c.cssColor ?? `rgb(${c.red}, ${c.green}, ${c.blue})`
}

/** Creates a small dot element for persistent overlays (CSS2DRenderer). */
export function makeDot(c: AcCmColor): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText =
    'width:12px;height:12px;border-radius:50%;' +
    `background:${cssColor(c)};border:2px solid white;box-sizing:border-box;` +
    'pointer-events:none;transform:translate(-50%,-50%);'
  return el
}

/** Creates a badge element for persistent overlays (CSS2DRenderer). */
export function makeBadge(c: AcCmColor, text = ''): HTMLDivElement {
  const el = document.createElement('div')
  el.textContent = text
  el.style.cssText =
    `background:rgba(255,255,255,0.95);color:${cssColor(c)};` +
    'font-size:13px;font-family:sans-serif;font-weight:500;' +
    'padding:3px 14px;border-radius:20px;pointer-events:none;' +
    'transform:translate(-50%,-50%);white-space:nowrap;' +
    'box-shadow:0 1px 4px rgba(0,0,0,0.2);'
  return el
}

/**
 * Creates a short-lived badge for live preview during jig interaction.
 * Appended to document.body with position:fixed and high z-index.
 * Caller is responsible for calling `.remove()` when done.
 */
export function makeLiveBadge(c: AcCmColor): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText =
    `position:fixed;background:rgba(255,255,255,0.95);color:${cssColor(c)};` +
    'font-size:13px;font-family:sans-serif;font-weight:500;' +
    'padding:3px 14px;border-radius:20px;pointer-events:none;' +
    'transform:translate(-50%,-50%);white-space:nowrap;' +
    'box-shadow:0 1px 4px rgba(0,0,0,0.2);z-index:99999;display:none;'
  document.body.appendChild(el)
  return el
}

/**
 * Creates a short-lived dot for live preview during jig interaction.
 * Appended to document.body with position:fixed and high z-index.
 * Caller is responsible for calling `.remove()` when done.
 */
export function makeLiveDot(c: AcCmColor): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText =
    'position:fixed;width:12px;height:12px;border-radius:50%;' +
    `background:${cssColor(c)};border:2px solid white;box-sizing:border-box;` +
    'pointer-events:none;transform:translate(-50%,-50%);z-index:99999;'
  document.body.appendChild(el)
  return el
}

/**
 * Creates a square snap indicator for entity snapping during jig interaction.
 * Appended to document.body with position:fixed and high z-index.
 * Caller is responsible for calling `.remove()` when done.
 */
export function makeSnapIndicator(c: AcCmColor): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText =
    `position:fixed;width:10px;height:10px;border:2px solid ${cssColor(c)};` +
    'background:transparent;pointer-events:none;box-sizing:border-box;' +
    'transform:translate(-50%,-50%);z-index:99998;display:none;'
  document.body.appendChild(el)
  return el
}

/**
 * Formats a distance value (in DWG world units) for display.
 *
 * DWG files typically store coordinates in millimeters (INSUNITS=4).
 * The `@mlightcad/data-model` library does not currently expose the
 * $INSUNITS header variable, so we treat all world units as **millimeters**
 * — which matches the convention used in Czech construction/architecture
 * drawings.
 *
 * If the upstream library adds INSUNITS support in the future, this
 * function can be extended to accept a database parameter and convert
 * dynamically.
 *
 * @param value - Raw distance in DWG world units (assumed mm)
 * @param decimals - Number of decimal places (default 1)
 */
export function formatDistance(value: number, decimals = 1): string {
  return `~ ${value.toFixed(decimals)} mm`
}

/**
 * Formats an area value (in DWG world units²) for display.
 *
 * Same assumption as {@link formatDistance}: world units are millimeters,
 * so area is in mm². For readability, large areas are shown in m².
 *
 * @param value - Raw area in DWG world units² (assumed mm²)
 * @param decimals - Number of decimal places (default 3)
 */
export function formatArea(value: number, decimals = 3): string {
  // 1 m² = 1_000_000 mm²
  if (value >= 1_000_000) {
    return `~ ${(value / 1_000_000).toFixed(decimals)} m²`
  }
  return `~ ${value.toFixed(decimals)} mm²`
}

/**
 * Creates a canvas overlay for drawing measurement graphics (arcs, fills, etc.).
 * Appended to the given container with position:absolute.
 * Caller is responsible for calling `.remove()` when done.
 */
export function makeOverlayCanvas(container: HTMLElement): HTMLCanvasElement {
  const el = document.createElement('canvas')
  el.style.cssText = 'position:absolute;pointer-events:none;z-index:1;'
  container.appendChild(el)
  return el
}
