import { defineConfig } from 'vite'
import type { ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.json'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Custom plugin to auto-compile content script and copy files
function autoContentScript() {
  return {
    name: 'auto-content-script',
    
    // Run before build starts
    buildStart() {
      console.log('🔧 Auto-compiling content script...')
      
      // Create public directories if they don't exist
      const publicStyles = path.resolve(__dirname, 'public/styles')
      const publicContent = path.resolve(__dirname, 'public/content')
      
      if (!fs.existsSync(publicStyles)) {
        fs.mkdirSync(publicStyles, { recursive: true })
      }
      if (!fs.existsSync(publicContent)) {
        fs.mkdirSync(publicContent, { recursive: true })
      }
      
      // Bundle TypeScript content script with esbuild (creates single IIFE file)
      try {
        execSync(
          'npx esbuild src/content/toast-injector.ts --bundle --format=iife --outfile=public/content/toast-injector.js --target=es2020',
          { stdio: 'inherit' }
        )
        console.log('✅ Content script bundled successfully')
      } catch (error) {
        console.error('❌ Failed to bundle content script:', error)
        throw error
      }
      
      // Copy CSS file
      try {
        const srcCss = path.resolve(__dirname, 'src/styles/toast-content-script.css')
        const destCss = path.resolve(__dirname, 'public/styles/toast-content-script.css')
        
        if (fs.existsSync(srcCss)) {
          fs.copyFileSync(srcCss, destCss)
          console.log('✅ CSS file copied successfully')
        } else {
          console.warn('⚠️  Source CSS file not found:', srcCss)
        }
      } catch (error) {
        console.error('❌ Failed to copy CSS file:', error)
        throw error
      }
    },
    
    // Watch mode: recompile on file changes
    configureServer(server: ViteDevServer) {
      const srcContentPath = path.resolve(__dirname, 'src/content/toast-injector.ts')
      const srcCssPath = path.resolve(__dirname, 'src/styles/toast-content-script.css')
      
      server.watcher.add([srcContentPath, srcCssPath])
      
      server.watcher.on('change', (file: string) => {
        if (file === srcContentPath) {
          console.log('📝 Rebundling content script...')
          try {
            execSync(
              'npx esbuild src/content/toast-injector.ts --bundle --format=iife --outfile=public/content/toast-injector.js --target=es2020',
              { stdio: 'inherit' }
            )
            console.log('✅ Content script rebundled')
          } catch (error) {
            console.error('❌ Rebundle failed:', error)
          }
        }
        
        if (file === srcCssPath) {
          console.log('📝 Copying CSS file...')
          try {
            fs.copyFileSync(srcCssPath, path.resolve(__dirname, 'public/styles/toast-content-script.css'))
            console.log('✅ CSS file copied')
          } catch (error) {
            console.error('❌ Copy failed:', error)
          }
        }
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    autoContentScript(), // ✨ 自動化插件
  ],
})
