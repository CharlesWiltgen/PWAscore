import { describe, expect, test } from 'vitest'
import { pickLocaleFromAcceptLanguage } from './locale-choice'

const LOCALES = ['en', 'fr']
const FALLBACK = 'en'

describe('pickLocaleFromAcceptLanguage', () => {
  test('matches by q-value, not header order', () => {
    expect(pickLocaleFromAcceptLanguage('fr;q=0.3,en;q=0.9', LOCALES, FALLBACK)).toBe('en')
    expect(pickLocaleFromAcceptLanguage('en;q=0.3,fr;q=0.9', LOCALES, FALLBACK)).toBe('fr')
  })

  test('matches a region tag by its primary subtag', () => {
    expect(pickLocaleFromAcceptLanguage('fr-CA,fr;q=0.9', LOCALES, FALLBACK)).toBe('fr')
    expect(pickLocaleFromAcceptLanguage('en-GB,en;q=0.9', LOCALES, FALLBACK)).toBe('en')
  })

  test('ignores languages the site does not serve and falls back', () => {
    expect(pickLocaleFromAcceptLanguage('de-DE,de;q=0.9,es;q=0.8', LOCALES, FALLBACK)).toBe('en')
    expect(pickLocaleFromAcceptLanguage(null, LOCALES, FALLBACK)).toBe('en')
    expect(pickLocaleFromAcceptLanguage('', LOCALES, FALLBACK)).toBe('en')
  })

  test('treats a wildcard as no preference', () => {
    expect(pickLocaleFromAcceptLanguage('*;q=1', LOCALES, FALLBACK)).toBe('en')
    expect(pickLocaleFromAcceptLanguage('*;q=1,fr;q=0.5', LOCALES, FALLBACK)).toBe('fr')
  })

  test('is case-insensitive and tolerant of spacing and junk q-values', () => {
    expect(pickLocaleFromAcceptLanguage(' FR-FR , fr;q=nonsense', LOCALES, FALLBACK)).toBe('fr')
  })

  test('prefers an earlier header entry when q-values tie', () => {
    expect(pickLocaleFromAcceptLanguage('fr-FR,fr;q=0.9,en-US,en;q=0.9', LOCALES, FALLBACK)).toBe('fr')
  })
})
