# Phase 4 Storage Checklist

Checklist ini dipakai untuk memvalidasi integrasi storage provider pada modul persuratan.
Target utamanya:
- mode development dengan `STORAGE_PROVIDER=local`
- transisi aman ke `STORAGE_PROVIDER=cloudinary`

## Status Saat Ini

- [x] Upload draft `surat keluar` via provider `local`
- [x] Path lokal `/uploads/...` diterima validator client dan server
- [x] Link draft tampil di arsip `surat keluar`
- [ ] Upload file `surat masuk` diuji manual end-to-end
- [ ] Upload `lampiran` `surat keluar` diuji manual end-to-end
- [ ] Upload `file final` `surat keluar` diuji manual end-to-end
- [ ] Validasi batas ukuran file diuji manual
- [ ] Validasi tipe file tidak valid diuji manual
- [ ] Provider `cloudinary` diuji manual end-to-end
- [ ] Provider `hosted` diimplementasikan

## Checklist Uji Local Storage

### 1. Surat Masuk

- [ ] Buat `surat masuk` baru dengan upload file PDF
- [ ] Pastikan record tersimpan dan link file tampil di daftar/detail
- [ ] Klik link file, pastikan file terbuka dari `/uploads/...`
- [ ] Edit `surat masuk` dan ganti file
- [ ] Pastikan file baru tersimpan dan UI refresh dengan benar
- [ ] Coba submit file kosong manual URL kosong, pastikan tetap bisa jika file memang opsional

### 2. Surat Keluar Draft

- [x] Buat `surat keluar` dengan upload draft
- [x] Pastikan record tersimpan
- [x] Pastikan link `Buka Draft` muncul dan bisa dibuka
- [ ] Edit `surat keluar` draft dan ganti file draft
- [ ] Pastikan URL draft terbaru tersimpan

### 3. Surat Keluar Lampiran

- [ ] Buat `surat keluar` dengan upload lampiran
- [ ] Pastikan link lampiran muncul di detail stepper
- [ ] Klik link lampiran dan pastikan file terbuka
- [ ] Uji kombinasi draft + lampiran pada submit yang sama

### 4. Surat Keluar File Final

- [ ] Pindahkan `surat keluar` sampai status `pengarsipan`
- [ ] Upload file final dari stepper
- [ ] Pastikan `fileFinalUrl` tersimpan
- [ ] Pastikan link file final muncul di detail stepper
- [ ] Klik link file final dan pastikan file terbuka
- [ ] Selesaikan pengarsipan setelah file final terunggah

## Checklist Uji Validasi

- [ ] Upload file di atas `STORAGE_MAX_FILE_MB`, pastikan ditolak dengan pesan yang jelas
- [ ] Upload file dengan MIME di luar whitelist, pastikan ditolak
- [ ] Manipulasi `contentType` yang tidak cocok dengan data URL, pastikan ditolak server
- [ ] Pastikan file PDF valid tetap lolos
- [ ] Pastikan JPG/PNG/WebP valid tetap lolos

## Checklist Uji Cloudinary

- [ ] Set `STORAGE_PROVIDER=cloudinary`
- [ ] Isi env Cloudinary valid
- [ ] Uji upload `surat masuk`
- [ ] Uji upload draft `surat keluar`
- [ ] Uji upload lampiran `surat keluar`
- [ ] Uji upload file final `surat keluar`
- [ ] Pastikan URL yang tersimpan adalah URL Cloudinary
- [ ] Pastikan semua link dapat dibuka tanpa mengubah UI

## Kriteria Siap Lanjut

Storage layer layak disebut stabil jika kondisi berikut terpenuhi:
- semua skenario `local` pada surat masuk dan surat keluar lolos
- validasi ukuran dan MIME sudah terbukti bekerja
- `cloudinary` lolos minimal untuk `surat masuk`, draft, lampiran, dan final
- tidak ada mismatch validator antara URL absolut dan path lokal
