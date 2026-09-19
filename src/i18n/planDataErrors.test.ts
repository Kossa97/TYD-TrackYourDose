import { readFileSync } from 'node:fs'
import { createInstance } from 'i18next'
import { expect, it } from 'vitest'

it.each(['de', 'en', 'ar', 'es', 'fr', 'hi', 'id', 'it', 'ja', 'ko', 'pt', 'ru', 'tr', 'zh'])('translates plan-data errors and retry in %s', async lng => {
  const i18n = createInstance()
  await i18n.init({ lng, fallbackLng: false, resources: {
    [lng]: { translation: JSON.parse(readFileSync(`src/i18n/locales/${lng}.json`, 'utf8')) },
  } })
  for (const key of ['pk_data_load_error', 'inj_plan_load_error', 'routine_confirmation_retry', 'my_stack_course_timezone_review', 'my_stack_course_timezone', 'my_stack_course_timezone_error', 'my_stack_course_timezone_confirm']) {
    expect(i18n.t(key)).not.toBe(key)
    expect(i18n.t(key).trim()).not.toBe('')
  }
  if (lng === 'en') expect(i18n.t('pk_data_load_error')).toBe('PK data could not be loaded.')
})
