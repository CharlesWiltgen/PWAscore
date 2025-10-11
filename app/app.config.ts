export default defineAppConfig({
  ui: {
    colors: {
      primary: 'blue',
      neutral: 'slate'
    },
    card: {
      slots: {
        root: 'ring-gray-500 dark:ring-gray-500'
      }
    },
    checkbox: {
      slots: {
        base: 'ring-gray-200 dark:ring-gray-200'
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
