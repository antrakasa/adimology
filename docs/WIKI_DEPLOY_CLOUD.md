# OPSI A: Deploy ke Cloud (Netlify + Supabase)

Ikuti langkah-langkah berikut secara berurutan untuk menjalankan Adimology di cloud menggunakan Netlify dan Supabase.

## A1. Setup Supabase

1. Buat akun dan project baru di [Supabase](https://supabase.com/)
2. Catat kredensial berikut dari **Integration > Data API**: `API URL` → catat untuk nanti di Netlify `NEXT_PUBLIC_SUPABASE_URL`
![Supabase Setup](https://raw.githubusercontent.com/bhaktiutama/adimology/main/public/supabase01.png)
3. Catat kredensial berikut dari **Project Settings > API Keys > Legacy anon, service_role API keys**: `anon public` key → catat untuk nanti di Netlify `NEXT_PUBLIC_SUPABASE_ANON_KEY`
![Supabase Setup](https://raw.githubusercontent.com/bhaktiutama/adimology/main/public/supabase02.png)


**PENTING: Persiapan Database (Wajib Sekali Saja)**
Agar migrasi otomatis dapat berjalan, Anda perlu menyiapkan infrastruktur pelacakan migrasi secara manual:
1. Buka folder **supabase** di repository ini, pilih file <a href="https://github.com/bhaktiutama/adimology/blob/main/supabase/000_init.sql" target="_blank">**000_init.sql**</a>, lalu salin (copy) seluruh teks yang ada di dalamnya.
2. Buka **SQL Editor** di Dashboard Supabase dan paste teks script tersebut.
3. Klik **Run**.
![Supabase Setup](https://raw.githubusercontent.com/bhaktiutama/adimology/main/public/supabase03.png)
4. Setelah berhasil, migrasi database lainnya (`001_...` dst) akan dijalankan otomatis setiap kali build di Netlify.

## A2. Deploy ke Netlify

1. **Fork Repository**: Pastikan Anda sudah memiliki dan login ke akun GitHub Anda. Buka link repository [Adimology](https://github.com/bhaktiutama/adimology/) ini di GitHub, lalu klik tombol **Fork** di pojok kanan atas. Ini akan membuat salinan project ini di akun GitHub Anda sendiri agar Anda bisa menghubungkannya ke Netlify.
![Supabase Setup](https://raw.githubusercontent.com/bhaktiutama/adimology/main/public/netlify01.png)
2. Jika sudah berhasil akan tampak seperti di bawah ini. Kedepannya klik Sync fork untuk mendapatkan update fitur terbaru.
![Supabase Setup](https://raw.githubusercontent.com/bhaktiutama/adimology/main/public/netlify02.png)
3. Login ke [Netlify](https://www.netlify.com/) dan klik **Add new site > Import an existing project**
4. Pilih Github, akan ada pop up untuk login ke github, ikuti saja langkahnya
![Supabase Setup](https://raw.githubusercontent.com/bhaktiutama/adimology/main/public/netlify03.png)
5. Pilih repository Adimology dari GitHub anda
![Supabase Setup](https://raw.githubusercontent.com/bhaktiutama/adimology/main/public/netlify04.png)
6. Tambahkan **Environment Variables** di Netlify:
![Supabase Setup](https://raw.githubusercontent.com/bhaktiutama/adimology/main/public/netlify05.png)

   | Variable | Nilai | Wajib |
   |----------|-------|:-----:|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL dari Supabase langkah A1 no 2| ✅ |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key dari Supabase langkah A1 no 3| ✅ |
   | `CRON_SECRET` | String acak untuk keamanan cron | ✅ |
   | `GEMINI_API_KEY` | API Key dari [Google AI Studio](https://aistudio.google.com/) | ✅ |
   | `GEMINI_STORY_MODEL` | Model Gemini untuk AI Story Analysis (opsional, default: `gemini-3-flash-preview`) | ❌ |
   | `GEMINI_STORY_THINKING_LEVEL` | Thinking level: `MINIMAL`/`LOW`/`MEDIUM`/`HIGH` (opsional, default: `HIGH`) | ❌ |

7. Klik **Deploy site** dan tunggu hingga selesai
8. Catat URL Netlify Anda (contoh: `https://your-app.netlify.app`) akan digunakan untuk proses berikutnya 

## A3. Setup Chrome Extension (untuk Cloud)

1. **Download File ke Komputer**: Jika Anda belum memiliki file ini di komputer, buka repository GitHub Anda, klik tombol **Code** (warna hijau), lalu pilih **Download ZIP**. Ekstrak (Extract) file tersebut ke folder pilihan Anda (misal di Desktop atau Documents).
![Supabase Setup](https://raw.githubusercontent.com/bhaktiutama/adimology/main/public/chrome-extension01.png)
2. Buka folder `stockbit-token-extension/` yang ada di dalam folder hasil ekstrak tadi.
3. Buat duplikat (Copy & Paste) untuk dua file berikut:
   - Duplikat `manifest.json.example` lalu ubah namanya menjadi `manifest.json`
   - Duplikat `background.js.example` lalu ubah namanya menjadi `background.js`
![Supabase Setup](https://raw.githubusercontent.com/bhaktiutama/adimology/main/public/chrome-extension02.png)

4. Edit `manifest.json` - ganti `YOUR_APP_DOMAIN` dengan URL Netlify Anda dari langkah A2 no 8:
   ```json
   "host_permissions": [
      "https://*.stockbit.com/*",
      "https://your-app.netlify.app/*"
   ]
   ```

5. Edit `background.js` - ganti `APP_API_URL` dengan URL Netlify Anda:
   ```javascript
   const APP_API_URL = "https://your-app.netlify.app/api/update-token";
   ```

6. Install ekstensi di Chrome:
   - Buka `chrome://extensions/`
   - Aktifkan **Developer mode** (pojok kanan atas)
   - Klik **Load unpacked**
   - Pilih folder `stockbit-token-extension`
![Supabase Setup](https://raw.githubusercontent.com/bhaktiutama/adimology/main/public/chrome-extension03.png)

## A4. Verifikasi Instalasi

1. Buka [Stockbit](https://stockbit.com/) dan login
2. Ekstensi akan otomatis menangkap dan mengirim token ke Supabase
3. Buka URL Netlify Anda
4. Cek indikator koneksi Stockbit di aplikasi - harus menunjukkan **Connected**
5. Coba analisis saham pertama Anda! 🎉

## A5. Checkpoint Troubleshooting Koneksi

Jika status di aplikasi masih **"Disconnected"** atau Token invalid, silakan lakukan [pemeriksaan poin-poin berikut](https://github.com/bhaktiutama/adimology/wiki/Checkpoint).

   