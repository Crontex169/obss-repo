import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // `vite preview` (derlenmis cikti) server.* ayarlarini KULLANMAZ - kendi
  // bloguna bakar. Tunelde dev sunucusu yerine bunu servis etmek icin ikisi de
  // gerekli: allowedHosts olmadan tunel host'u reddedilir, proxy olmadan
  // /api/* 404 doner (tek-origin topoloji bozulur).
  //
  // NEDEN dev yerine preview: dev modu bagimliliklari paketlemez, lucide-react
  // tek basina 550 KB (gzip) gelir ve quick tunnel bant genisliginde ~40 sn
  // surer. Derleme tree-shake ettigi icin ayni ekran ~106 KB'a duser.
  preview: {
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: false },
    },
  },
  server: {
    // Cloudflare quick tunnel rastgele bir *.trycloudflare.com host'u verir;
    // vite varsayilan olarak bilinmeyen Host basliklarini reddeder.
    allowedHosts: ['.trycloudflare.com'],
    // Tek origin: tarayici /api/* isteklerini tunel adresine atar, vite backend'e
    // yollar. Boylece CORS ve ucuncu-taraf cerez sorunu olusmaz.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        // Host basligi korunmali: backend baseURL'i istegin geldigi host'tan
        // cozuyor (better-auth.config.ts allowedHosts). changeOrigin varsayilan
        // true, Host'u localhost:3000 yapar ve tunel adresi kaybolur - Google
        // redirect_uri ve dogrulama maili linki yanlis host'a gider.
        changeOrigin: false,
      },
    },
  },
})
