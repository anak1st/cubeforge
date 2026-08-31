import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { REVISION } from 'three'
import './index.css'
import App from './ui/App.tsx'

// three.js 集成冒烟：M1 将建立正式场景（docs/plan.md）
console.info(`[cubeforge] three.js r${REVISION}`)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
