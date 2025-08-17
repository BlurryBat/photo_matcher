import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Replace "my-vision-app" with your repo name when deploying to GitHub Pages
export default defineConfig({
  plugins: [react()],
  base: "/my-vision-app/"
})