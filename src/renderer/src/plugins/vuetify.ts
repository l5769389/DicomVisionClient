import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

export const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'dicomVisionDark',
    themes: {
      dicomVisionDark: {
        dark: true,
        colors: {
          background: '#07111b',
          surface: '#0b1726',
          'surface-bright': '#12263c',
          primary: '#2a95e4',
          secondary: '#f26a2f',
          info: '#7dd3fc',
          success: '#34d399',
          warning: '#fbbf24',
          error: '#fb7185'
        }
      }
    }
  }
})
