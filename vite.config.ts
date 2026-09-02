/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  test: {
    // 只跑本仓库用例:refs/ 下的参考仓库自带测试,vitest 默认会一并扫入
    include: ['src/**/*.test.ts'],
    // 回退到 M0 演示后暂无用例;算法重新落地时用例会随之回来
    passWithNoTests: true,
  },
})
