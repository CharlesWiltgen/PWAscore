/**
 * Generate Open Graph social sharing image from homepage screenshot
 * - Launches dev server
 * - Takes 1024px width screenshot
 * - Resizes to 1200px width and crops top 630px
 * - Saves to public/og-image.png
 */

import { spawn } from 'node:child_process'
import { writeFileSync, existsSync } from 'node:fs'
import { createConnection } from 'node:net'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import sharp from 'sharp'

const OUTPUT_PATH = join(process.cwd(), 'public', 'og-image.png')
const DEV_SERVER_URL = 'http://localhost:3000'
const DEV_SERVER_ORIGIN = new URL(DEV_SERVER_URL)
const DEV_SERVER_PORT = Number(DEV_SERVER_ORIGIN.port)
const OG_IMAGE_WIDTH = 1200
const OG_IMAGE_HEIGHT = 630

// Chrome executable paths for different platforms
const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
  '/usr/bin/google-chrome', // Linux
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' // Windows
]

function findChrome() {
  for (const path of CHROME_PATHS) {
    if (existsSync(path)) {
      return path
    }
  }
  throw new Error(
    'Chrome not found. Please install Chrome or set CHROME_PATH environment variable.'
  )
}

function portInUse(host) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port: DEV_SERVER_PORT })
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
    socket.setTimeout(2000, () => {
      socket.destroy()
      resolve(false)
    })
  })
}

async function assertPortFree() {
  // Nuxt binds IPv6 localhost only, so check both stacks before trusting a miss.
  const occupied = (await portInUse('127.0.0.1')) || (await portInUse('::1'))
  if (occupied) {
    throw new Error(
      `Port ${DEV_SERVER_PORT} is already in use — stop that server first, otherwise the screenshot captures it instead of this script's own instance (its DevTools overlay ends up in og-image.png).`
    )
  }
}

async function startDevServer() {
  console.log('Starting dev server...')
  // Refuse to run when something already holds the port: the script would
  // screenshot that instance instead of its own (devtools on, different build),
  // silently shipping a polluted og-image — seen 2026-09-16, when a running dev
  // server left a DevTools timing pill over the Firefox card.
  await assertPortFree()
  const server = spawn('pnpm', ['run', 'dev'], {
    detached: true,
    stdio: 'pipe',
    env: { ...process.env, NUXT_DEVTOOLS_ENABLED: 'false' }
  })

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Dev server failed to start within 30 seconds'))
    }, 30000)

    server.stdout.on('data', (data) => {
      const output = data.toString()
      // Vite moves to the next free port when the one it wants is taken, so a
      // readiness banner only means "a dev server started". Trust it only when
      // it names our port — otherwise the port was taken after the pre-flight
      // check and this run would photograph a server it does not own. The
      // banner may colour the URL, but the colour codes wrap `localhost:3000`
      // rather than split it, so a plain substring test is exact about the port.
      const advertised = (() => {
        const named = output.match(/Local:\s+(https?:\/\/\S+)/)?.[1]
        if (named) return named
        return output.includes(`localhost:${DEV_SERVER_PORT}`)
          ? DEV_SERVER_URL
          : null
      })()
      if (!advertised) return
      let bound
      try {
        bound = new URL(advertised)
      } catch {
        // Colour codes can land inside the capture; the substring check above
        // already proved the port, so treat an unparseable banner as ours.
        bound = DEV_SERVER_ORIGIN
      }
      if (bound.port !== DEV_SERVER_ORIGIN.port) {
        clearTimeout(timeout)
        process.kill(-server.pid)
        reject(
          new Error(
            `Dev server came up on ${bound.origin} instead of ${DEV_SERVER_ORIGIN.origin} — something took port ${DEV_SERVER_PORT} after the pre-flight check. Stop it and retry.`
          )
        )
        return
      }
      clearTimeout(timeout)
      console.log('✓ Dev server ready')
      resolve(server)
    })

    server.stderr.on('data', (data) => {
      console.error('Server error:', data.toString())
    })

    server.on('error', (err) => {
      clearTimeout(timeout)
      reject(err)
    })
  })
}

async function takeScreenshot() {
  const chromePath = process.env.CHROME_PATH || findChrome()
  console.log(`Using Chrome: ${chromePath}`)

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    const page = await browser.newPage()

    // Set viewport to 1200px width for OG image
    await page.setViewport({
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      deviceScaleFactor: 1
    })

    console.log(`Navigating to ${DEV_SERVER_URL}...`)
    await page.goto(DEV_SERVER_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    })

    // Wait for browser score cards to render (inside ClientOnly, after API data loads)
    console.log('Waiting for score cards to render...')
    try {
      await page.waitForFunction(
        () => document.querySelectorAll('[class*="UCard"], .flex.flex-col.space-y-4 .font-semibold').length >= 3,
        { timeout: 45000 }
      )
      console.log('✓ Score cards detected')
    } catch {
      console.warn('⚠ Score cards not detected, taking screenshot anyway')
    }

    // Extra time for fonts and final layout
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Measure banner and header height to skip them
    const skipHeight = await page.evaluate(() => {
      const header = document.querySelector('header')
      const headerRect = header?.getBoundingClientRect()
      // Skip everything above main content
      return headerRect ? headerRect.bottom : 0
    })

    console.log(`Skipping banner and header (${skipHeight}px)`)
    console.log('Taking screenshot...')

    const screenshot = await page.screenshot({
      type: 'png',
      clip: {
        x: 0,
        y: skipHeight,
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT
      }
    })

    console.log('✓ Screenshot captured')
    return screenshot
  } finally {
    await browser.close()
  }
}

async function processImage(screenshotBuffer) {
  console.log('Processing image...')
  console.log(`- Optimizing PNG (${OG_IMAGE_WIDTH}x${OG_IMAGE_HEIGHT}px)`)

  const processedImage = await sharp(screenshotBuffer)
    .png({
      quality: 90,
      compressionLevel: 9
    })
    .toBuffer()

  return processedImage
}

async function generateOGImage() {
  let server = null

  try {
    // Start dev server
    server = await startDevServer()

    // Take screenshot
    const screenshot = await takeScreenshot()

    // Process image (resize and crop)
    const processedImage = await processImage(screenshot)

    // Save to public directory
    console.log(`Saving to: ${OUTPUT_PATH}`)
    writeFileSync(OUTPUT_PATH, processedImage)

    const fileSizeKB = (processedImage.length / 1024).toFixed(2)
    console.log(`✓ OG image generated successfully (${fileSizeKB} KB)`)
    console.log(`  Dimensions: ${OG_IMAGE_WIDTH}x${OG_IMAGE_HEIGHT}px`)
  } catch (error) {
    console.error('Failed to generate OG image:', error)
    process.exit(1)
  } finally {
    // Kill dev server
    if (server) {
      console.log('Stopping dev server...')
      process.kill(-server.pid)
    }
  }
}

generateOGImage()
