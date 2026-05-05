# Checkpoint: Integrasi DingTalk Attendance

Terakhir diupdate: 2026-05-06

## Status

Fitur sync absensi dari DingTalk sudah dibuat di UI dan backend, tapi **data selalu kosong saat sync**.

## Yang Sudah Dicoba

### Pull API — Tidak Berhasil

| API | Endpoint | Hasil |
|-----|----------|-------|
| `attendance/list` | `oapi.dingtalk.com/attendance/list` | `recordresult: []` |
| `getupdatedata` | `oapi.dingtalk.com/topapi/attendance/getupdatedata` | semua list kosong |

- Sudah coba **OAuth2 token baru** (`api.dingtalk.com/v1.0/oauth2/accessToken`)
- Sudah coba **token lama** (`oapi.dingtalk.com/gettoken`)
- Hasil sama: kosong semua
- Data **ada** di `attend.dingtalk.com` (admin UI DingTalk) — Andi Awaludin punya data clock-in 2026-05-04
- Semua 14 user DingTalk dicoba, semua tanggal dicoba — tetap kosong

### Permission yang Sudah Di-enable di Developer Platform

- `qyapi_get_attendance_data`
- `qyapi_attendance_group_read`
- (dan 5 permission attendance lainnya)
- Versi app sudah dipublish (1.0.3)

## Dugaan Root Cause

Organisasi belum sertifikasi DingTalk (terlihat dari halaman Organization profile: "Organization Information [Verified Organization Exclusive]"). Kemungkinan attendance API dibatasi untuk org yang belum verified. Tidak ada dokumentasi resmi yang mengkonfirmasi ini.

## File Relevan

| File | Keterangan |
|------|------------|
| `src/lib/dingtalk/attendance.ts` | Logic fetch attendance dari DingTalk API |
| `src/lib/dingtalk/auth.ts` | Token management (OAuth2 baru + token lama) |
| `src/server/actions/dingtalk/sync-attendance.ts` | Server action sync + upsert ke DB |
| `src/components/absensi/AbsensiManager.tsx` | UI tombol sync |
| `src/components/absensi/AbsensiCalendar.tsx` | Tampilan data absensi |
| `src/app/api/absensi/route.ts` | API route GET absensi |

## Opsi Selanjutnya

### Opsi 1: Webhook `attendance_check_record`
DingTalk push data ke ARKA setiap ada check-in (bukan ARKA yang poll).

**Langkah:**
1. Buat endpoint `/api/dingtalk/event` di ARKA
2. Daftar event subscription di developer platform DingTalk → subscribe `attendance_check_record`
3. Handle payload → simpan ke `absensiKaryawan`

**Syarat:** ARKA harus punya URL HTTPS publik (bukan localhost)
**Kelemahan:** Hanya data mulai dari sekarang — tidak bisa ambil data historis

### Opsi 2: Import CSV
Admin export CSV dari `attend.dingtalk.com`, upload ke ARKA, sistem parse dan simpan.

**Kelebihan:** Bisa untuk data historis
**Kelemahan:** Manual, tidak real-time

### Rekomendasi
Gabungan keduanya: CSV import untuk data lama, webhook untuk data berjalan.

## Catatan Teknis

- `absensiKaryawan` schema sudah support `userId = null` (unlinked DingTalk user)
- Unlinked user tetap tersimpan dengan `dingtalkNama` dan `dingtalkUserId`
- UI sudah tampilkan unlinked user dengan badge "(DingTalk)"
- Debug `console.log` masih ada di `attendance.ts` — perlu dihapus sebelum production
