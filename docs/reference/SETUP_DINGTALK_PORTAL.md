# Panduan Setup DingTalk Open Platform

Panduan ini menjelaskan langkah-langkah membuat dan mengkonfigurasi aplikasi DingTalk untuk integrasi absensi dan cuti ke sistem ARKA.

---

## Prasyarat

- Akun DingTalk yang sudah menjadi **admin organisasi**
- Organisasi sudah aktif menggunakan DingTalk

---

## 1. Masuk ke Developer Console

1. Buka **https://open.dingtalk.com**
2. Klik tombol **"开发者后台"** (pojok kanan atas, tombol biru)
3. Login dengan akun DingTalk admin

---

## 2. Buat Aplikasi Baru

1. Di halaman developer console, klik menu **"App Development"** di navbar atas
2. Pilih tab **"企业应用"** (Enterprise App) — bukan "快捷应用"
3. Klik tombol **"创建应用"** (pojok kanan atas) → pilih **"创建应用"** dari dropdown
   > Jangan pilih "委托服务商开发" (itu untuk pihak ketiga)
4. Isi form:
   - **应用名称** (App Name): `ARKAIntegration`
     > Hanya huruf, angka, tanpa spasi
   - **应用描述** (Description): `Integrasi absensi dan cuti karyawan untuk sistem ARKA`
   - **应用图标** (Icon): opsional, bisa skip
5. Klik **"保存"** (Save)

---

## 3. Catat Kredensial

1. Di sidebar kiri, klik **"凭证与基础信息"** (Credentials & Basic Info)
2. Catat dua nilai berikut:
   - **Client ID** (原AppKey): contoh `dingxhy7wh4g07uzzuar`
   - **Client Secret** (原AppSecret): klik icon copy untuk dapat nilai penuh

3. Simpan ke file `.env.local` di project:

```env
DINGTALK_APP_KEY=<nilai_client_id>
DINGTALK_APP_SECRET=<nilai_client_secret>
DINGTALK_BASE_URL=https://api.dingtalk.com
```

---

## 4. Aktifkan Permission

1. Di sidebar kiri, klik **"权限管理"** (Permission Management)

### 4.1 Permission Absensi

Klik kategori **"考勤"** di sidebar kategori kiri, aktifkan:

| Nama Permission | Permission Code | Tombol |
|----------------|-----------------|--------|
| 考勤组查询权限 | `qyapi_attendance_group_read` | 立即开通 |
| 查询企业考勤数据权限 | `qyapi_get_attendance_data` | 立即开通 |

### 4.2 Permission Data User

Klik kategori **"通讯录管理"** di sidebar kategori kiri, aktifkan:

| Nama Permission | Permission Code | Tombol |
|----------------|-----------------|--------|
| 成员信息读权限 | `qyapi_get_member` | 立即开通 |

> Status **"已开通"** (hijau) = permission aktif

---

## 5. Publish Aplikasi

Permission baru efektif setelah app di-publish.

1. Di sidebar kiri, klik **"版本管理与发布"** (Version Management & Publish)
2. Klik **"创建新版本"** (pojok kanan atas)
3. Isi form:
   - **应用版本号**: `1.0.0` (sudah terisi otomatis)
   - **版本描述**: `Initial release - integrasi absensi dan cuti`
   - **应用可用范围**: pilih **"全部员工"** (semua karyawan)
4. Klik **"保存"**
5. Klik **"发布"** → muncul dialog konfirmasi
6. Klik **"确认发布"**

> Dialog akan menyebut "本次发布免审，提交后自动通过并在线上生效" = publish tanpa review, langsung aktif.

---

## 6. Verifikasi Koneksi

Setelah env vars diisi dan app di-publish:

1. Buka sistem ARKA → menu **Administrasi → Pengaturan**
2. Pilih tab **"Sistem & Integrasi"**
3. Di card **"Test Koneksi"**, klik **"Test DingTalk"**
4. Hasil sukses: `DingTalk OK (Xms). Token diterima.`

---

## Ringkasan Permission yang Diaktifkan

| Permission Code | Fungsi |
|----------------|--------|
| `qyapi_attendance_group_read` | Baca grup & aturan absensi |
| `qyapi_get_attendance_data` | Baca data clock-in/out karyawan |
| `qyapi_get_member` | Baca data user untuk mapping pegawai |
| `qyapi_base` | Base API (aktif otomatis) |

---

## Troubleshooting

| Masalah | Solusi |
|---------|--------|
| Error saat buat app: "Application names can only be composed of..." | Nama app tidak boleh pakai spasi atau karakter khusus |
| Test koneksi gagal: `401` | Periksa APP_KEY dan APP_SECRET di `.env.local` |
| Test koneksi gagal: `403` | Permission belum aktif atau app belum di-publish |
| Test koneksi gagal: `timeout` | Periksa koneksi internet / IP whitelist di Security Settings |

---

## Referensi

| Resource | URL |
|----------|-----|
| DingTalk Developer Console | https://open-dev.dingtalk.com |
| Attendance API Docs | https://open.dingtalk.com/document/orgapp/attendance-overview |
| Access Token Docs | https://open.dingtalk.com/document/orgapp/obtain-orgapp-token |
