import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource/patrick-hand/400.css'
import '@fontsource-variable/nunito'
import './output.css'
// KaTeX math styles + fonts — needed by both the offscreen text measurer and the SVG rasterizer
import 'katex/dist/katex.min.css'
import App from './App.jsx'
import { AuthProvider } from './contexts/AuthContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
