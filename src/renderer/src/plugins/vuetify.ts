import 'vuetify/styles'
import { createVuetify } from 'vuetify'

export default createVuetify({
  theme: {
    defaultTheme: 'dicomVision',
    themes: {
      dicomVision: {
        dark: true,
        colors: {
          background: '#08111a',
          surface: '#0e1622',
          primary: '#2f8ce4',
          secondary: '#eb6a2a',
          info: '#7dc4ff'
        }
      }
    }
  },
  defaults: {
    VBtn: {
      rounded: 'xl',
      elevation: 0
    },
    VCard: {
      rounded: 'xl',
      elevation: 0
    },
    VTextField: {
      variant: 'solo-filled',
      density: 'comfortable',
      hideDetails: true
    }
  }
})
