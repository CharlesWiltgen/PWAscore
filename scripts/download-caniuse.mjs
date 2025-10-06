/**
 * Download CanIUse data from GitHub
 * Saves to public/data/caniuse-data.json
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

const CANIUSE_DATA_URL
  = 'https://raw.githubusercontent.com/Fyrd/caniuse/refs/heads/main/fulldata-json/data-2.0.json'
const OUTPUT_PATH = join(process.cwd(), 'public', 'data', 'caniuse-data.json')

async function downloadCanIUseData() {
  console.log('Downloading CanIUse data from GitHub...')
  console.log(`URL: ${CANIUSE_DATA_URL}`)

  try {
    const response = await fetch(CANIUSE_DATA_URL)

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.text()
    const sizeInMB = (data.length / (1024 * 1024)).toFixed(2)

    console.log(`Downloaded ${sizeInMB} MB`)
    console.log(`Saving to: ${OUTPUT_PATH}`)

    writeFileSync(OUTPUT_PATH, data, 'utf-8')

    console.log('✓ CanIUse data downloaded successfully')
  } catch (error) {
    console.error('Failed to download CanIUse data:', error)
    process.exit(1)
  }
}

downloadCanIUseData()
