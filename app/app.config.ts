export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue',
      neutral: 'slate'
    },
    checkbox: {
      slots: {
        base: 'border-gray-400 dark:border-gray-400'
      }
    },
    prose: {
      h2: {
        slots: {
          base: 'relative text-2xl text-highlighted font-bold mt-6 mb-4 scroll-mt-[calc(48px+45px+var(--ui-header-height))]'
        }
      }
    }
  }
})
