# Operation — GesturePad

Knowledge base komersial dan operasional untuk **GesturePad**, ekstensi Chrome Manifest V3
buatan [PT. Sainskerta Solusi Nusantara](https://sainskerta.net) — software house & AI partner
berbasis di Gedung Graha Mampang Lt. 3, Jakarta Selatan, beroperasi sejak 2013.

GesturePad mengubah webcam biasa menjadi pengendali browser tanpa sentuh: 21 landmark tangan
dilacak dengan MediaPipe HandLandmarker (CPU, dibundel lokal), delapan gesture dikenali oleh mesin
geometri murni tanpa classifier machine learning, dan aksi live dijalankan pada tab nyata —
mundur, maju, reload, tab baru, duplikasi tab. Seluruh pemrosesan berlangsung di perangkat:
satu-satunya permission yang dideklarasikan adalah `storage`, tidak ada backend, tidak ada
telemetri, tidak ada akun, dan tidak ada panggilan jaringan pada saat berjalan.

Seluruh dokumen di folder ini disusun dari fakta yang terbaca di repositori (`README.md`,
`manifest.json`, `background.js`, `app.html`, `js/`, `css/`, `vendor/`, `docs/`, `promo/`,
`LICENSE`) dan dari riset kompetitor nyata yang sumbernya dicantumkan di tiap dokumen.

> **Catatan penting.** Harga, target pasar, proyeksi pendapatan, ambang akurasi, nilai RTO/RPO,
> dan target SLA dalam dokumen ini berstatus **usulan — perlu validasi manajemen**. Beberapa
> kapabilitas yang muncul sebagai prasyarat komersial (modul lisensi, profil terkunci, listing
> resmi Chrome Web Store, penguncian tuning) belum terdapat pada kode v1.0.0 dan ditandai jujur
> di dalam dokumen terkait.

## 01-Business-Strategy

| Dokumen | Isi Singkat |
|---|---|
| [01-Business-Model-Canvas](01-Business-Strategy/01-Business-Model-Canvas.docx) | Sembilan blok model bisnis dan implikasi open-core |
| [02-ICP-dan-Segmentasi-Pasar](01-Business-Strategy/02-ICP-dan-Segmentasi-Pasar.docx) | Profil pelanggan ideal dan segmen yang tidak dikejar |
| [03-Analisis-Kompetitor](01-Business-Strategy/03-Analisis-Kompetitor.docx) | Peta pesaing gesture control dan alat aksesibilitas |
| [04-Analisis-SWOT](01-Business-Strategy/04-Analisis-SWOT.docx) | Kekuatan, kelemahan, peluang, ancaman, dan strategi |

## 02-Sales

| Dokumen | Isi Singkat |
|---|---|
| [05-Proposal-Penjualan-B2B-Kiosk](02-Sales/05-Proposal-Penjualan-B2B-Kiosk.docx) | Proposal segmen kios dan layanan publik sentuh-bebas |
| [05-Proposal-Penjualan-B2C-Prosumer](02-Sales/05-Proposal-Penjualan-B2C-Prosumer.docx) | Proposal segmen prosumer produktivitas dan aksesibilitas |
| [06-Statement-of-Work](02-Sales/06-Statement-of-Work.docx) | Tahap kerja pilot, keluaran, termin, dan kriteria terima |
| [07-Pricing-dan-Packaging](02-Sales/07-Pricing-dan-Packaging.docx) | Paket, harga usulan, diskon, dan struktur biaya |
| [08-Sales-Playbook-dan-Battlecard](02-Sales/08-Sales-Playbook-dan-Battlecard.docx) | Alur kualifikasi, demo, dan kartu tempur kompetitor |
| [09-Product-Datasheet](02-Sales/09-Product-Datasheet.docx) | Spesifikasi teknis, ambang gestur, dan batasan produk |

## 03-Pre-Sales

| Dokumen | Isi Singkat |
|---|---|
| [10-Discovery-Questionnaire](03-Pre-Sales/10-Discovery-Questionnaire.docx) | Kuesioner penemuan dan daftar penghenti peluang |
| [11-Demo-Script-dan-PoC-Plan](03-Pre-Sales/11-Demo-Script-dan-PoC-Plan.docx) | Naskah demo 15 menit dan PoC 10 hari kerja |
| [12-Technical-Proposal](03-Pre-Sales/12-Technical-Proposal.docx) | Penempatan arsitektur, prasyarat, dan batas integrasi |
| [13-ROI-dan-Business-Case](03-Pre-Sales/13-ROI-dan-Business-Case.docx) | Perhitungan manfaat, sensitivitas, dan kriteria keputusan |

## 04-IT-Communication

| Dokumen | Isi Singkat |
|---|---|
| [14-Arsitektur-Solusi](04-IT-Communication/14-Arsitektur-Solusi.docx) | Komponen, aliran data satu frame, dan keputusan desain |
| [15-Arsitektur-Keamanan-dan-Threat-Model](04-IT-Communication/15-Arsitektur-Keamanan-dan-Threat-Model.docx) | Tujuh ancaman nyata dan pengendalian aktual |
| [16-Privasi-Data-dan-Kepatuhan](04-IT-Communication/16-Privasi-Data-dan-Kepatuhan.docx) | Pemetaan pemrosesan kamera ke UU PDP No. 27/2022 |

## 05-Resilience-Operations

| Dokumen | Isi Singkat |
|---|---|
| [17-Business-Continuity-Plan](05-Resilience-Operations/17-Business-Continuity-Plan.docx) | Kontinuitas repo, signing, akun developer, dan dukungan |
| [18-Disaster-Recovery-Plan](05-Resilience-Operations/18-Disaster-Recovery-Plan.docx) | Target RTO/RPO aset rilis dan prosedur pemulihan |
| [19-SOP-Insiden-dan-Breach-Response](05-Resilience-Operations/19-SOP-Insiden-dan-Breach-Response.docx) | Deteksi sampai notifikasi, peran, dan eskalasi |
| [20-SLA-dan-Model-Dukungan](05-Resilience-Operations/20-SLA-dan-Model-Dukungan.docx) | Tingkatan dukungan, waktu respons, dan cakupan |

## Cara Membaca Suite Ini

1. Mulai dari `01` sampai `04` untuk memahami posisi pasar dan batasan produk.
2. Lanjut ke `02-Sales` untuk materi yang dipakai langsung di depan pelanggan.
3. Gunakan `03-Pre-Sales` saat menyiapkan discovery, demo, dan uji penerimaan.
4. Baca `04-IT-Communication` bersama tim keamanan dan DPO pelanggan.
5. Tutup dengan `05-Resilience-Operations` untuk kontrak dukungan dan kesiapan insiden.

Tiga butir yang berulang di seluruh dokumen dan wajib diputuskan manajemen sebelum komersialisasi:
keputusan hak komersialisasi atas kode berlisensi MIT, pembangunan layer lisensi dan profil
terkunci, serta publikasi paket resmi bertanda tangan di Chrome Web Store.

## Penerbit

PT. Sainskerta Solusi Nusantara — Gedung Graha Mampang Lt. 3, Jakarta Selatan
hello@sainskerta.id · +62 813-5988-3131 · sainskerta.net

Dokumen bersifat rahasia dan hanya untuk pemakaian internal serta prospek bisnis yang
telah menandatangani perjanjian kerahasiaan.

© 2026 PT. Sainskerta Solusi Nusantara · hello@sainskerta.id · sainskerta.net
