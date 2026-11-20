/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

function properties(source: string): Record<string, string> {
  return Object.fromEntries(
    source
      .split('\n')
      .map(line => line.trim())
      .filter(line => line !== '' && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=')
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()]
      })
  ) as Record<string, string>
}

describe('SonarQube wiring', () => {
  const sonar = properties(read('../sonar-project.properties'))
  const vitest = read('../vitest.config.ts')
  const pkg = JSON.parse(read('../package.json')) as {
    scripts?: Record<string, string>
  }

  it('points the scanner at the shipped trees and LCOV report', () => {
    expect(sonar['sonar.projectKey']).toBe('PWAscore')
    expect(sonar['sonar.sources']).toBe('app,server')
    expect(sonar['sonar.javascript.lcov.reportPaths']).toBe('coverage/lcov.info')
  })

  it('writes LCOV where the scanner reads it', () => {
    expect(vitest).toContain(`reportsDirectory: './coverage'`)
    expect(vitest).toContain(`reporter: ['text', 'lcov']`)
    expect(vitest).toContain(
      `include: ['app/**/*.{ts,vue}', 'server/**/*.ts']`
    )
  })

  it('makes the scan block on the gate after coverage', () => {
    expect(sonar['sonar.qualitygate.wait']).toBe('true')
    expect(sonar['sonar.qualitygate.timeout']).toBe('300')
    const scan = pkg.scripts?.['sonar:scan'] ?? ''
    expect(scan).toContain('test:coverage')
    expect(scan).toContain('fnox get SONAR_TOKEN')
    expect(scan.indexOf('test:coverage')).toBeLessThan(
      scan.indexOf('sonar-scanner')
    )
    expect(scan).not.toContain('qualitygate.ignoreFail')
  })
})
