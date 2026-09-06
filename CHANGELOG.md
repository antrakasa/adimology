# Changelog

Riwayat lengkap perubahan Adimology. 3 versi terbaru selalu ditampilkan di [README.md](README.md#changelog); versi yang lebih lama diarsipkan di sini.

### v0.4.0 (2026-02-23)
- **High-Fidelity Copy Image**: Migrasi dari `html2canvas` ke `html-to-image` untuk hasil capture yang lebih tajam (HD) dan akurat.
- **Transparent Corners**: Optimalisasi capture spesifik pada elemen card untuk menghasilkan pojok yang transparan (rounded).
- **Clean Capture**: Penambahan fitur filter otomatis untuk menyembunyikan tombol aksi footer dari hasil gambar copy.

### v0.3.3 (2026-02-22)
- **Password Protection**: Implementasi keamanan akses aplikasi dengan proteksi password.
- **Session-based Unlocking**: Mekanisme akses satu kali per sesi.
- **Reset Documentation**: Panduan pemulihan akses melalui Supabase jika lupa password.

### v0.3.2 (2026-02-22)
- **Local Watchlist & Normalization**: Mengalihkan penyimpanan data watchlist dari Stockbit API ke database lokal (cache-first) dengan struktur database yang lebih efisien.
- **Status Indicator UI**: Pembaruan indikator status token dengan warna **Orange** untuk status "Expiring", serta pemindahan indikator proses fetching stockbit ke Navbar untuk mencegah *layout shifting*.
- **Spinner & Aesthetics**: Pembaruan gaya visual spinner menjadi transparan (arc-only) dan penyatuan status sinkronisasi *Watchlist* ke indikator global di Navbar.
- **Documentation Migration**: Memindahkan panduan instalasi lengkap ke Wiki (`docs/WIKI_DEPLOY_LOCAL.md` & `docs/WIKI_DEPLOY_CLOUD.md`) untuk menjaga agar README tetap ringkas.

### v0.3.1 (2026-02-19)
- **Responsive Navbar**: Implementasi menu hamburger untuk tampilan mobile, memindahkan indikator status dan toggle tema ke dalam sub-menu.
- **Card UI Fixes**: Perbaikan alignment logo/judul pada navbar dan penanganan nama sektor yang sangat panjang (elipsis) pada card ringkasan.
- **Scroll Optimization**: Menonaktifkan vertical scroll pada `CompactResultCard` dan `BrokerSummaryCard` untuk menjaga konsistensi visual saat pengambilan screenshot/copy image.

### v0.3.0 (2026-02-16)
- **New Summary & Performance Dashboard**: Dasbor khusus untuk melacak performa emiten dalam jangka waktu tertentu (3, 5, 10, 20, 50 hari trading).
- **Hit Rate Analytics**: Kalkulasi otomatis "Hit Rate R1", "Hit Rate Max", dan "Total Hit Rate" berdasarkan riwayat analisis nyata.
- **Top 3 Bandar Tracking**: Menampilkan 3 broker paling aktif untuk setiap emiten, lengkap dengan jumlah kemunculan dan klasifikasi tipe (Whale, Smart Money, Retail, Mix).
- **Fix PDF Export Global**: Perbaikan bug di mana beberapa emiten terlewati pada "All Per Emiten PDF" serta memastikan filter diterapkan secara global (bukan hanya halaman aktif).
- **UI/UX Refinements**: Standarisasi ukuran font, peningkatan kontras warna label pada Dark Mode, dan optimalisasi layout kolom untuk keterbacaan data yang lebih baik.

### v0.2.0 (2026-02-15)
- **Advanced PDF Export**: Sistem pelaporan PDF baru yang lebih informatif, mencakup:
  - Format portrait yang dioptimalkan (muat 20 baris per halaman).
  - Ringkasan statistik agregat (Hit R1, Hit Max, Avg Bandar Plus/Minus).
  - Ringkasan frekuensi Bandar per emiten.
  - Grafik performa visual (dot tracking) terintegrasi dalam PDF.
- **Revamp UI Tabel Riwayat**: Pembaruan gaya tombol "Solid-Btn" yang lebih premium dan konsisten di seluruh aplikasi, serta perbaikan visibilitas elemen pada Dark Mode.
- **Sinkronisasi Format Laporan**: Menyamakan format output antara "Filtered PDF" dan "Per Emiten PDF" untuk konsistensi data.
