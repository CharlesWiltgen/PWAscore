/**
 * Generate Open Graph social sharing image from homepage screenshot
 * - Launches dev server
 * - Takes 1024px width screenshot
 * - Resizes to 1200px width and crops top 630px
 * - Saves to public/og-image.png
 */

import { spawn } from 'node:child_process'
import { writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import puppeteer from 'puppeteer-core'
import sharp from 'sharp'

const OUTPUT_PATH = join(process.cwd(), 'public', 'og-image.png')
const DEV_SERVER_URL = 'http://localhost:3000'
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

async function startDevServer() {
  console.log('Starting dev server...')
  const server = spawn('npm', ['run', 'dev'], {
    detached: true,
    stdio: 'pipe'
  })

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Dev server failed to start within 30 seconds'))
    }, 30000)

    server.stdout.on('data', (data) => {
      const output = data.toString()
      if (output.includes('Local:') || output.includes('localhost:3000')) {
        clearTimeout(timeout)
        console.log('✓ Dev server ready')
        resolve(server)
      }
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
      waitUntil: 'networkidle0',
      timeout: 30000
    })

    // Wait for hero section to be visible
    await page.waitForSelector('h1', { timeout: 10000 })

    // Give a moment for fonts and styles to load
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Measure banner and header height to skip them
    const skipHeight = await page.evaluate(() => {
      const banner = document.querySelector('[class*="banner"]')
      const header = document.querySelector('header')
      const bannerHeight = banner?.offsetHeight || 0
      const headerHeight = header?.offsetHeight || 0
      return bannerHeight + headerHeight
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
