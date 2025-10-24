import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './App.css'
import { Provider } from 'react-redux'
import store from './store/store'
import { LanguageProvider } from './i18n/LanguageProvider'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </Provider>
  </React.StrictMode>
)
