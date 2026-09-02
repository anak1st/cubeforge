import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { REVISION } from 'three'
import './index.css'
import App from './ui/App.tsx'

// three.js 集成冒烟:打印版本号确认依赖可用
console.info(`[cubeforge] three.js r${REVISION}`)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
