import type { FaqCategory } from '../types'

/** FAQ Bahasa Indonesia */
export const idCategories: FaqCategory[] = [
  {
    id: 'start',
    title: 'Memulai & navigasi',
    items: [
      {
        q: 'Apa itu Peptid Tracker?',
        a: 'Peptid Tracker adalah aplikasi pribadi untuk keperluan penelitian. Anda dapat mengelola peptida, merencanakan siklus asupan, mencatat dosis, menghitung dosis, mencatat efek di jurnal, dan menulis ulasan—semuanya dalam satu tempat.',
      },
      {
        q: 'Bagaimana cara berpindah antar bagian?',
        a: 'Di bagian bawah layar ada navigasi dengan 5 ikon: Stok, Peptida, Beranda (tengah), Kalender, dan Profil. Semua area lain diakses dari layar Beranda di tengah.',
      },
      {
        q: 'Apa itu layar Beranda?',
        a: [
          'Layar Beranda (tombol tengah di navigasi) adalah pusat Anda:',
          '• Di atas Anda melihat 3 statistik cepat: Siklus aktif, Vial di stok, Peptida saya',
          '• Di bawahnya ada ubin untuk semua 8 area aplikasi',
          '• Ketuk ubin untuk langsung menuju ke sana',
        ],
      },
      {
        q: 'Apa saja area aplikasi?',
        a: [
          '📅 Kalender – log harian, konfirmasi dosis & ringkasan siklus',
          '📦 Stok – inventaris bahan mentah, simpan & kelola vial',
          '🧪 Peptida – peptida yang direkonstitusi & buat siklus',
          '🧮 Kalkulator – kalkulator dosis dengan skala jarum suntik',
          '📓 Jurnal – catat efek dan efek samping',
          '⭐ Ulasan – laporan pengalaman untuk peptida tertentu',
          '👤 Profil – data akun, profil publik & tautan berbagi',
          '❓ FAQ – halaman bantuan ini',
        ],
      },
      {
        q: 'Bagaimana cara keluar?',
        a: 'Buka “Profil” dan ketuk tombol merah “Keluar” di kanan atas.',
      },
      {
        q: 'Apakah data saya disimpan dengan aman?',
        a: 'Ya. Semua data disimpan di database Supabase. Setiap pengguna hanya melihat data sendiri—ini ditegakkan dengan Row Level Security (RLS). File batch (PDF/gambar) ada di bucket penyimpanan terpisah dan hanya dapat diakses oleh Anda.',
      },
      {
        q: 'Bisakah saya memasang aplikasi di ponsel?',
        a: [
          'Ya! Peptid Tracker adalah PWA (Progressive Web App):',
          'iPhone/Safari: ikon Bagikan → “Tambahkan ke Layar Utama” → “Tambah”',
          'Android/Chrome: tiga titik → “Pasang aplikasi” atau “Tambahkan ke layar utama”',
          'Aplikasi kemudian berjalan tanpa bilah browser dan terasa seperti aplikasi asli.',
        ],
      },
      {
        q: 'Dari mana sebaiknya saya mulai?',
        a: [
          'Urutan yang disarankan:',
          '1. “Peptida” → “+ Baru” → buat peptida (nama, bahan aktif, rekonstitusi, stok)',
          '2. “Tambah siklus” langsung di kartu peptida',
          '3. Gunakan “Kalkulator” untuk menghitung unit & konsentrasi',
          '4. Buka “Kalender” – siklus muncul dengan latar ungu',
          '5. Ketuk hari siklus → catat dosis & konfirmasi',
        ],
      },
    ],
  },
  {
    id: 'kalender',
    title: 'Kalender & log',
    items: [
      {
        q: 'Apa yang ditampilkan kalender?',
        a: [
          'Kalender memberi ringkasan sekilas:',
          '🟣 Latar ungu = siklus aktif direncanakan untuk hari itu',
          '🔵 Titik biru = dosis dicatat untuk hari itu',
          '🔵 Cincin langit = hari ini',
          '🟠 Ikon panah oranye = peningkatan dosis aktif pada hari itu',
        ],
      },
      {
        q: 'Bagaimana cara mencatat dosis?',
        a: [
          '1. Ketuk hari di kalender',
          '2. Siklus aktif muncul sebagai kartu di panel hari di bawah',
          '3. Ketuk siklus → formulir log terbuka dengan isian awal',
          '4. Sesuaikan dosis, metode, atau waktu jika perlu',
          '5. Ketuk “Simpan”',
        ],
      },
      {
        q: 'Apa itu konfirmasi dosis?',
        a: [
          'Setelah mencatat Anda dapat mengonfirmasi setiap dosis:',
          '✅ “Diambil” – entri ditandai hijau',
          '❌ “Tidak diambil” – entri ditandai merah dan opsi tunda muncul',
          'Sampai Anda mengonfirmasi, kedua tombol muncul di kartu entri.',
        ],
      },
      {
        q: 'Apa itu tunda (snooze)?',
        a: [
          'Saat Anda ketuk “Tidak diambil”, tombol tunda muncul:',
          '⏰ 15 menit – pengingat dalam 15 menit',
          '⏰ 30 menit – pengingat dalam 30 menit',
          '⏰ 1 jam – pengingat dalam 1 jam',
          '⏰ 2 jam – pengingat dalam 2 jam',
          'Saat berbunyi, toast menampilkan peptida dan dosis.',
        ],
      },
      {
        q: 'Apa arti panah oranye di kalender?',
        a: 'Panah oranye (📈 peningkatan aktif) berarti peningkatan dosis dari siklus Anda berlaku hari itu. Dosis yang ditampilkan di panel hari sudah merupakan total dosis yang dinaikkan.',
      },
      {
        q: 'Bagaimana cara berpindah antar bulan?',
        a: 'Ketuk panah kiri/kanan di samping nama bulan.',
      },
      {
        q: 'Bisakah saya menghapus dosis yang sudah dicatat?',
        a: 'Ya. Di panel hari ada tombol ✕ di kanan setiap entri → ketuk dan konfirmasi.',
      },
      {
        q: 'Mengapa tidak ada latar ungu padahal saya punya siklus?',
        a: [
          'Kemungkinan penyebab:',
          '• Siklus “Tidak aktif” → di Peptida → siklus → nyalakan sakelar',
          '• Bulan yang salah → geser ke bulan mulai siklus',
          '• Tanggal mulai/akhir tidak mencakup bulan ini',
        ],
      },
    ],
  },
  {
    id: 'peptide',
    title: 'Peptida & stok',
    items: [
      {
        q: 'Bagaimana cara membuat peptida baru?',
        a: [
          '1. Ketuk “+ Baru” di kanan atas',
          '2. Masukkan nama atau pilih dari “Dikenal”',
          '3. Isi bahan aktif & rekonstitusi (mg/vial, cairan, jarum suntik)',
          '4. Masukkan stok, info batch, dan dosis',
          '5. Opsional: unggah PDF atau gambar dokumen analisis',
          '6. Ketuk “Simpan”',
        ],
      },
      {
        q: 'Apa yang ditampilkan vial animasi di kartu peptida?',
        a: [
          'Jika Anda memasukkan stok, vial animasi muncul di kiri kartu:',
          '🟢 Hijau = lebih dari 50% stok tersisa',
          '🟡 Kuning = 25–50% stok',
          '🔴 Merah = kurang dari 25% – akan segera habis',
          'Cairan beranimasi. Di ponsel vial miring mengikuti orientasi perangkat.',
        ],
      },
      {
        q: 'Apa fungsi tombol info (ikon catatan) di kartu peptida?',
        a: [
          'Ikon catatan (📄) membuka lembar info dengan semua data tersimpan:',
          '• Dosis & rute',
          '• Bahan aktif, volume cairan, jarum suntik',
          '• Tanggal rekonstitusi & kedaluwarsa dengan hitung mundur',
          '• Stok & bilah kemajuan',
          '• Nomor batch & sumber',
          '• Dokumen analisis: gambar inline, PDF sebagai tautan',
          '• Catatan',
        ],
      },
      {
        q: 'Apa itu manajemen stok?',
        a: [
          'Anda dapat memasukkan berapa vial yang Anda miliki:',
          '• “Vial tersedia” = stok saat ini',
          '• Saat simpan pertama nilai ini diingat sebagai baseline 100%',
          '• Bilah kemajuan di kartu menampilkan konsumsi berwarna',
          '• Kedaluwarsa dihitung dari tanggal rekonstitusi + masa simpan',
        ],
      },
      {
        q: 'Apa itu informasi batch?',
        a: [
          'Informasi batch mendokumentasikan asal peptida Anda:',
          '• Nomor batch = ID lot produsen',
          '• Sumber = produsen atau pemasok (mis. “Peptide Sciences”)',
          '• Dokumen analisis = unggah PDF atau gambar (COA, laporan lab, faktur)',
          'Ini juga muncul di lembar info peptida.',
        ],
      },
      {
        q: 'Apa arti “Cairan ditambahkan (mL)”?',
        a: 'Itu berapa banyak air (mis. air BAC, NaCl, atau air steril untuk injeksi) yang Anda tambahkan ke vial. Lebih banyak cairan berarti konsentrasi lebih rendah. Nilai umum 1–2 mL.',
      },
      {
        q: 'Apa arti bidang jarum suntik “mL” dan “unit”?',
        a: [
          'Kedua bidang ini mendeskripsikan jarum suntik Anda:',
          '• mL = volume total jarum suntik (mis. 1 mL)',
          '• Unit = tanda skala maksimum (mis. 100 pada jarum suntik U-100)',
          '→ Dari itu: unit/mL = tanda per mililiter',
          'Jarum suntik insulin U-100 standar: 1 mL / 100 unit = 100 unit/mL',
        ],
      },
      {
        q: 'Apa itu masa simpan setelah rekonstitusi?',
        a: [
          'Setelah melarutkan peptida, stabilitasnya terbatas (di kulkas):',
          '10–14 hari = peptida berumur pendek',
          '21–28 hari = umum untuk peptida yang direkonstitusi',
          '42–90 hari = peptida yang sangat stabil',
          'Kedaluwarsa dihitung dari tanggal rekonstitusi + hari yang dipilih dan ditampilkan berwarna.',
        ],
      },
      {
        q: 'Bagaimana cara menambah siklus dari kartu peptida?',
        a: 'Setiap kartu peptida memiliki tombol ungu “Tambah siklus” di kanan bawah. Ketuk—Anda tidak perlu membuka peptida terlebih dahulu.',
      },
      {
        q: 'Apa arti panah dengan jumlah siklus di bawah?',
        a: 'Panah kecil di kiri bawah (mis. “▼ 2 siklus”) membuka atau menutup tampilan siklus. Anda langsung melihat berapa siklus ada untuk peptida ini.',
      },
      {
        q: 'Bagaimana cara mencari peptida?',
        a: 'Setelah ada peptida, bidang pencarian muncul di atas. Ketik nama—daftar difilter otomatis. Gunakan dropdown di sampingnya untuk mengurutkan A→Z atau Z→A.',
      },
    ],
  },
  {
    id: 'rechner',
    title: 'Kalkulator',
    items: [
      {
        q: 'Apa yang bisa dilakukan kalkulator?',
        a: [
          'Dari input Anda kalkulator menghitung:',
          '• Unit untuk diambil – berapa tanda pada jarum suntik',
          '• Konsentrasi – mg/mL larutan jadi',
          '• Isian jarum suntik – berapa persen jarum suntik yang diambil',
          '• Dosis per vial – berapa injeksi dari satu vial',
        ],
      },
      {
        q: 'Apa itu skala jarum suntik?',
        a: [
          'Skala berwarna di atas menampilkan secara visual berapa unit yang diambil:',
          '• Bilah terisi kiri (biru) ke kanan (ungu → merah muda)',
          '• Garis putih menandai titik tepat',
          '• Angka besar di atas menampilkan unit',
          'Anda langsung melihat apakah dosis muat di jarum suntik.',
        ],
      },
      {
        q: 'Input apa yang dibutuhkan kalkulator?',
        a: [
          '• Ukuran jarum suntik – pilih preset (mis. 1 mL / 100 unit) atau masukkan nilai kustom',
          '• Aktif per vial – mg pada vial (mis. 10 mg)',
          '• Cairan ditambahkan – berapa mL yang ditambahkan (mis. 2 mL)',
          '• Dosis – dosis target dengan satuan (mcg, mg, IU)',
        ],
      },
      {
        q: 'Preset jarum suntik apa yang ada?',
        a: [
          '• 1 mL · 100 unit (U-100) – jarum suntik insulin standar',
          '• 0,5 mL · 50 unit (U-100) – jarum suntik insulin kecil',
          '• 0,3 mL · 30 unit (U-100) – jarum suntik sangat kecil',
          '• 2 mL · 200 unit (U-100) – jarum suntik lebih besar',
          '• 1 mL · 40 unit (U-40) – jarum suntik U-40 lama',
          'Atau: masukkan mL dan unit kustom.',
        ],
      },
      {
        q: 'Contoh – bagaimana perhitungannya?',
        a: [
          'Contoh: BPC-157, vial 5 mg, 2 mL air, dosis 500 mcg, jarum suntik U-100',
          '→ Konsentrasi: 5 mg ÷ 2 mL = 2,5 mg/mL = 2500 mcg/mL',
          '→ Volume: 500 mcg ÷ 2500 mcg/mL = 0,200 mL',
          '→ Unit: 0,200 mL × 100 unit/mL = 20 unit',
          '→ Dosis/vial: 5000 mcg ÷ 500 mcg = 10 dosis',
        ],
      },
    ],
  },
  {
    id: 'zyklen',
    title: 'Siklus',
    items: [
      {
        q: 'Apa itu siklus?',
        a: 'Siklus adalah rencana asupan terstruktur untuk suatu peptida. Mendefinisikan dosis, metode, frekuensi, rentang waktu, waktu asupan opsional, dan pengingat.',
      },
      {
        q: 'Bagaimana cara membuat siklus?',
        a: [
          '1. Di kartu peptida ketuk “+ Tambah siklus” (tombol ungu)',
          '2. Isi nama, dosis, frekuensi, dan tanggal',
          '3. Opsional: atur waktu asupan dan pengingat',
          '4. Ketuk “Simpan”',
          'Siklus otomatis muncul di kalender!',
        ],
      },
      {
        q: 'Opsi frekuensi apa yang ada?',
        a: [
          '• Harian · Dua kali sehari · Setiap hari bergantian',
          '• 5 hari aktif / 2 libur (5on/2off)',
          '• Sen–Jum · Mingguan',
          '• Setiap X hari – interval kustom',
          '• Pilih hari kerja – mis. hanya Sen, Rab, Jum',
        ],
      },
      {
        q: 'Apa arti sakelar Aktif/Tidak aktif?',
        a: 'Aktif = siklus tampil di kalender (hari ungu). Tidak aktif = siklus dijeda, tidak terlihat di kalender. Alihkan dengan mengetuk sakelar di kanan siklus.',
      },
      {
        q: 'Apa itu waktu asupan?',
        a: [
          'Opsional – mengatur waktu dalam hari:',
          '🌅 Pagi = 08:00 · ☀️ Siang = 12:00 · 🌙 Malam = 20:00 · 🕐 Waktu kustom',
          'Digunakan untuk pengingat. Opsional—bisa dikosongkan.',
        ],
      },
      {
        q: 'Bagaimana pengingat bekerja?',
        a: [
          'Pengingat multi-pilih—Anda bisa memilih beberapa:',
          '• 1 hari sebelumnya – pengingat 24 jam sebelum asupan',
          '• 2 jam sebelumnya – lead time 2 jam',
          '• Saat asupan – tepat pada waktu yang diatur',
          'Aplikasi meminta izin notifikasi saat Anda menyimpan.',
          'Penting: hanya berfungsi saat aplikasi terbuka.',
        ],
      },
      {
        q: 'Bisakah ada beberapa siklus untuk satu peptida?',
        a: 'Ya, sebanyak yang Anda inginkan. Semua siklus aktif tampil di kalender. Berguna mis. untuk pagi + malam atau fase dosis berbeda.',
      },
    ],
  },
  {
    id: 'escalation',
    title: 'Peningkatan dosis',
    items: [
      {
        q: 'Apa itu peningkatan dosis?',
        a: 'Kenaikan dosis terencana dalam suatu siklus. Contoh: mulai 200 mcg, setelah 2 minggu +100 mcg, setelah 4 minggu +100 mcg lagi. Beberapa langkah memungkinkan.',
      },
      {
        q: 'Bagaimana cara menambah peningkatan dosis?',
        a: [
          '1. Buka peptida → temukan siklus → bagian “Peningkatan dosis”',
          '2. Ketuk “+ Tambah”',
          '3. Masukkan jumlah peningkatan dan satuan',
          '4. Pilih mulai: tanggal tetap / setelah X hari / setelah X minggu',
          '5. Opsional: tambah catatan → Simpan',
        ],
      },
      {
        q: 'Apakah peningkatan dosis ditampilkan di kalender?',
        a: [
          'Ya! Sejak peningkatan berlaku:',
          '• 📈 oranye di panel hari menampilkan “Tahap X aktif”',
          '• Dosis yang ditampilkan sudah total yang dinaikkan (dasar + peningkatan)',
          '• Ikon peningkatan muncul di legenda kalender',
        ],
      },
      {
        q: 'Apa arti opsi mulai?',
        a: [
          '• Tanggal tetap – dari hari mana peningkatan berlaku',
          '• Setelah X hari – X hari setelah mulai siklus',
          '• Setelah X minggu – hari setara setelah mulai siklus',
        ],
      },
      {
        q: 'Bisakah ada beberapa langkah?',
        a: 'Ya, sebanyak yang Anda inginkan. Dinomori #1, #2, #3. Semua langkah aktif dijumlahkan.',
      },
    ],
  },
  {
    id: 'tagebuch',
    title: 'Jurnal',
    items: [
      {
        q: 'Apa itu jurnal?',
        a: 'Di sini Anda mendokumentasikan efek dan efek samping peptida. Membantu melihat pola—efek apa kapan muncul, seberapa kuat, dan berapa lama.',
      },
      {
        q: 'Apa bedanya efek dan efek samping?',
        a: [
          '✅ Efek (hijau) = hasil yang diinginkan (tidur, penyembuhan, energi...)',
          '⚠️ Efek samping (oranye) = hasil yang tidak diinginkan (nyeri, kelelahan...)',
        ],
      },
      {
        q: 'Apa arti opsi status?',
        a: [
          '🔘 Tertunda – belum terjadi',
          '✅ Terjadi – aktif hadir',
          '⏳ Masih berlangsung – berlanjut',
          '✅ Mereda – sudah berlalu',
          'Ubah status langsung di kartu tanpa membuka formulir.',
        ],
      },
      {
        q: 'Apa itu skala intensitas (1–5)?',
        a: [
          '1 = Hampir tidak terasa · 2 = Ringan · 3 = Sedang · 4 = Kuat · 5 = Sangat kuat',
        ],
      },
      {
        q: 'Bagaimana cara memfilter dan mencari jurnal?',
        a: [
          '• Tab: Semua / Efek / Efek samping',
          '• Pencarian: filter berdasarkan deskripsi dan nama peptida',
          '• Urutkan: tanggal (baru/lama), intensitas (tinggi/rendah)',
        ],
      },
    ],
  },
  {
    id: 'bewertungen',
    title: 'Ulasan',
    items: [
      {
        q: 'Apa itu ulasan?',
        a: 'Laporan pengalaman pribadi untuk peptida tertentu. Dengan bintang (1–5), pengalaman keseluruhan (baik/sedang/buruk), pro dan kontra, serta tulisan detail.',
      },
      {
        q: 'Bagaimana cara membuat ulasan?',
        a: [
          '1. Di “Ulasan” ketuk “+ Baru”',
          '2. Pilih peptida → beri bintang → pilih pengalaman',
          '3. Masukkan judul (wajib) → opsional laporan, pro, kontra',
          '4. Simpan',
        ],
      },
      {
        q: 'Bagaimana cara mencari dan mengurutkan ulasan?',
        a: [
          '• Pencarian: judul dan nama peptida',
          '• Urutkan: terbaru / terlama / rating tinggi / rating rendah',
        ],
      },
      {
        q: 'Bisakah saya membagikan ulasan di profil?',
        a: 'Ya. Di “Profil” nyalakan sakelar “Ulasan”—lalu muncul di tautan profil publik Anda.',
      },
    ],
  },
  {
    id: 'profil',
    title: 'Profil & berbagi',
    items: [
      {
        q: 'Apa yang bisa saya masukkan di profil?',
        a: [
          '• Nama pengguna (untuk tautan berbagi) – wajib',
          '• Nama tampilan, usia, jenis kelamin, berat, tinggi',
          '• Catatan pribadi (hanya untuk Anda)',
          '• Bio publik (ditampilkan di profil bersama)',
        ],
      },
      {
        q: 'Bagaimana cara mengaktifkan profil publik?',
        a: [
          '1. Masukkan nama pengguna dan simpan profil',
          '2. Nyalakan sakelar utama “Bagikan profil”',
          '3. Aktifkan area individual (Peptida / Kalender / Jurnal / Ulasan)',
          '4. Simpan → tautan muncul dan bisa disalin',
        ],
      },
      {
        q: 'Konten apa yang bisa dibagikan?',
        a: [
          'Setiap area punya sakelar sendiri:',
          '🧪 Peptida · 📅 Kalender & siklus · 📖 Jurnal · ⭐ Ulasan',
          'Anda bisa mis. hanya membagikan ulasan dan menjaga sisanya privat.',
        ],
      },
      {
        q: 'Bisakah mematikan berbagi kapan saja?',
        a: 'Ya. Matikan sakelar utama “Bagikan profil” → simpan. Tautan langsung menampilkan “Profil ini privat”.',
      },
    ],
  },
  {
    id: 'erinnerung',
    title: 'Pengingat & tunda',
    items: [
      {
        q: 'Bagaimana cara mengatur pengingat?',
        a: [
          '1. Buat atau edit siklus',
          '2. Atur waktu asupan (pagi/siang/malam/kustom)',
          '3. Di bawah “Pengingat” pilih satu atau lebih opsi (multi-pilih)',
          '4. Simpan → aplikasi meminta izin notifikasi',
        ],
      },
      {
        q: 'Bisakah memilih beberapa waktu pengingat?',
        a: 'Ya. Anda bisa mis. mengaktifkan “1 hari sebelumnya” dan “Saat asupan” sekaligus. Centang menunjukkan yang aktif.',
      },
      {
        q: 'Apa bedanya pengingat dan tunda?',
        a: [
          'Pengingat (di siklus) = notifikasi terencana sebelum asupan',
          'Tunda (di kalender) = pengingat lanjutan setelah Anda menandai dosis “Tidak diambil” (15 menit / 30 menit / 1 jam / 2 jam)',
        ],
      },
      {
        q: 'Mengapa saya tidak mendapat pengingat?',
        a: [
          '• Izin notifikasi ditolak → aktifkan di pengaturan ponsel',
          '• Aplikasi tidak terbuka saat waktu pengingat',
          '• Waktu pengingat hari ini sudah lewat',
          '• Siklus “Tidak aktif”',
        ],
      },
      {
        q: 'Apakah pengingat bekerja saat aplikasi ditutup?',
        a: 'Saat ini tidak. Notifikasi berbasis browser dan membutuhkan aplikasi terbuka (tab atau PWA). Pengiriman latar belakang memerlukan layanan push.',
      },
    ],
  },
  {
    id: 'technik',
    title: 'Teknis & privasi',
    items: [
      {
        q: 'Mengapa saya melihat “Gagal menyimpan”?',
        a: [
          '• Tidak ada koneksi internet',
          '• Bidang wajib belum diisi',
          '• Sesi berakhir → keluar dan masuk lagi',
          '• Unggah PDF: bucket penyimpanan belum disiapkan → jalankan SQL di Supabase',
        ],
      },
      {
        q: 'Mengapa saya tidak bisa mengunggah PDF?',
        a: [
          'Bucket penyimpanan “batch-files” harus disiapkan sekali di Supabase:',
          '1. supabase.com → proyek Anda → SQL Editor → tab baru',
          '2. Tempel dan jalankan SQL dari “supabase-inventory.sql”',
          'Unggahan langsung berfungsi setelahnya.',
        ],
      },
      {
        q: 'Apa yang terjadi pada data saat saya keluar?',
        a: 'Data Anda tetap di server. Setelah login berikutnya semua entri masih ada.',
      },
      {
        q: 'Apakah data dihapus jika saya uninstall aplikasi?',
        a: 'Tidak. Data ada di server (Supabase)—terpisah dari perangkat. Cukup masuk lagi di perangkat mana pun.',
      },
      {
        q: 'Apakah aplikasi cocok untuk penggunaan medis?',
        a: 'Tidak. Hanya untuk penelitian dan dokumentasi. Bukan pengganti saran medis. Selalu konsultasikan dokter.',
      },
      {
        q: 'Bisakah menggunakan aplikasi di tablet atau perangkat kedua?',
        a: [
          'Ya. Karena semuanya di cloud, aplikasi berfungsi di banyak perangkat:',
          '1. Buka URL yang sama di browser',
          '2. Masuk dengan akun yang sama',
          '3. Semua data langsung tersedia',
          'Untuk akses kode (pengembangan): clone repositori di GitHub.',
        ],
      },
    ],
  },
]
