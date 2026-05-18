# Requirements Document

## Introduction

Modul Workshop Evaluation Analytics adalah sistem manajemen dan evaluasi kegiatan PPL (Pendidikan Profesional Lanjutan) untuk IAI Jakarta. Modul ini mencakup pengelolaan kegiatan workshop/seminar/PPL, manajemen narasumber dengan fee per SKP, kuesioner evaluasi peserta dengan form builder fleksibel, tracking registrasi & kehadiran, serta dashboard analytics internal untuk perencanaan program tahunan berbasis data.

Modul ini bersifat internal (hanya diakses oleh staf IAI Jakarta) dan terintegrasi dengan ekosistem Arka yang sudah ada (events, projects, SKP calculator).

## Glossary

- **Kegiatan**: Sebuah workshop, seminar, atau aktivitas PPL yang dikelola oleh IAI Jakarta, baik online maupun offline
- **PPL**: Pendidikan Profesional Lanjutan — program pengembangan kompetensi berkelanjutan bagi akuntan profesional
- **SKP**: Satuan Kredit Profesi — unit kredit yang diperoleh peserta dari mengikuti kegiatan PPL
- **Narasumber**: Pembicara atau pengajar yang menyampaikan materi dalam kegiatan PPL
- **Kategori_PPL**: Klasifikasi bidang kegiatan PPL (Perpajakan, Akuntansi Keuangan, Audit, dll.)
- **Kuesioner**: Formulir evaluasi pasca-kegiatan yang diisi oleh peserta untuk menilai kualitas kegiatan
- **Form_Builder**: Komponen yang memungkinkan admin membuat formulir evaluasi dengan berbagai tipe field secara dinamis
- **Config_JSON**: Struktur data JSON yang menyimpan konfigurasi formulir evaluasi (field types, labels, options)
- **Answers_JSON**: Struktur data JSON yang menyimpan jawaban peserta atas kuesioner evaluasi
- **Likert_Scale**: Skala penilaian numerik (misal 1-5) yang digunakan dalam kuesioner evaluasi
- **Grid_Field**: Tipe field matriks yang menampilkan baris (pernyataan) dan kolom (skala) dalam format tabel
- **Pendaftar**: Peserta yang telah mendaftar untuk mengikuti kegiatan
- **Realisasi_Hadir**: Jumlah peserta yang benar-benar hadir pada hari pelaksanaan kegiatan
- **Conversion_Rate**: Rasio antara Realisasi_Hadir dibandingkan Pendaftar, dinyatakan dalam persentase
- **Analytics_Dashboard**: Halaman internal yang menampilkan visualisasi data evaluasi, kehadiran, dan tren kegiatan
- **Modul_Evaluasi**: Subsistem yang menangani pembuatan kuesioner, pengumpulan jawaban, dan analisis hasil evaluasi
- **Honorarium**: Fee yang dibayarkan kepada Narasumber atas jasa penyampaian materi, dihitung berdasarkan SKP
- **Program_Tahunan**: Rencana kegiatan PPL untuk satu tahun ke depan yang disusun berdasarkan data historis

## Requirements

### Requirement 1: Manajemen Kegiatan PPL

**User Story:** As a staf admin IAI Jakarta, I want to manage PPL activities with detailed categorization, so that all workshops/seminars are properly recorded and categorized for reporting and planning.

#### Acceptance Criteria

1. THE Modul_Evaluasi SHALL provide a CRUD interface for creating, reading, updating, and deleting Kegiatan records
2. WHEN a new Kegiatan is created, THE Modul_Evaluasi SHALL require the following fields: nama kegiatan (maksimum 255 karakter), Kategori_PPL, tanggal mulai, tanggal selesai, tipe pelaksanaan (online/offline/hybrid), lokasi (maksimum 255 karakter), dan SKP
3. THE Modul_Evaluasi SHALL support the following Kategori_PPL values: Perpajakan, Sistem Informasi & Softskill, Akuntansi Keuangan, Audit, Akuntansi Syariah, Akuntansi Manajemen, Akuntansi Manajemen dan Manajemen Keuangan, Akuntansi Perpajakan, Manajemen Keuangan, Akuntansi Keuangan & Softskill, Akuntansi Keuangan dan Manajemen Keuangan, Manajemen Strategik, SAK & PSAK
4. WHEN a Kegiatan is created, THE Modul_Evaluasi SHALL automatically calculate SKP using the formula: (tanggal selesai − tanggal mulai + 1) × 8 SKP, unless a manual SKP value between 1 and 999 is provided
5. THE Modul_Evaluasi SHALL store tipe pelaksanaan as one of: "online", "offline", or "hybrid"
6. WHEN a Kegiatan has associated Kuesioner responses or attendance records, THE Modul_Evaluasi SHALL prevent deletion, set the Kegiatan status to "archived", hide it from the default active list view, and retain all associated data
7. IF tanggal selesai is earlier than tanggal mulai, THEN THE Modul_Evaluasi SHALL reject the creation or update and display a validation error indicating that tanggal selesai must be equal to or later than tanggal mulai
8. IF a user attempts to update a Kegiatan with status "archived", THEN THE Modul_Evaluasi SHALL reject the update and display a message indicating that archived Kegiatan cannot be modified

### Requirement 2: Manajemen Narasumber

**User Story:** As a staf admin IAI Jakarta, I want to manage speaker profiles with their expertise and fee rates, so that I can track which speakers are suitable for which topics and calculate their honorarium.

#### Acceptance Criteria

1. THE Modul_Evaluasi SHALL provide a CRUD interface for managing Narasumber profiles with fields: nama (maksimal 200 karakter), email (format valid, maksimal 150 karakter), nomor telepon (maksimal 30 karakter, hanya angka dan tanda +/-), dan status aktif (boolean, default true)
2. WHEN a Narasumber is created, THE Modul_Evaluasi SHALL allow associating one or more Kategori_PPL as areas of expertise
3. THE Modul_Evaluasi SHALL store topik-topik yang dikuasai per Narasumber per Kategori_PPL, dengan setiap topik maksimal 200 karakter dan maksimal 20 topik per Kategori_PPL per Narasumber
4. THE Modul_Evaluasi SHALL store fee Honorarium per SKP for each Narasumber sebagai nilai numerik dalam satuan Rupiah (IDR) dengan rentang 0 hingga 99.999.999
5. WHEN a Narasumber is assigned to a Kegiatan, THE Modul_Evaluasi SHALL automatically calculate total Honorarium as: fee per SKP × jumlah SKP kegiatan
6. THE Modul_Evaluasi SHALL allow linking a Narasumber to multiple Kegiatan with different topik per assignment, dengan topik assignment maksimal 200 karakter
7. IF a Narasumber is referenced by existing Kegiatan assignments, THEN THE Modul_Evaluasi SHALL deactivate the Narasumber (set status aktif = false) instead of deleting the record
8. IF a Narasumber is created or updated with an email that already exists in another Narasumber record, THEN THE Modul_Evaluasi SHALL reject the operation and display an error message indicating duplicate email

### Requirement 3: Form Builder Kuesioner Evaluasi

**User Story:** As a staf admin IAI Jakarta, I want to build flexible evaluation questionnaires with various field types, so that I can collect structured feedback from participants after each event.

#### Acceptance Criteria

1. THE Form_Builder SHALL allow creating questionnaire templates with a configurable list of fields stored as Config_JSON, where each template has a nama template (maximum 200 characters) and contains between 1 and 50 fields
2. THE Form_Builder SHALL support the following field types: text, textarea, number, email, select, radio, checkbox, scale (Likert_Scale), and grid (Grid_Field), where each field must have a label (maximum 300 characters) and a defined field type
3. WHEN a scale field is configured, THE Form_Builder SHALL allow setting minimum value and maximum value (integers between 1 and 10, where minimum must be less than maximum) and labels for each endpoint (maximum 50 characters per label)
4. WHEN a grid field is configured, THE Form_Builder SHALL allow defining between 1 and 30 row labels (pernyataan, maximum 300 characters each) and between 2 and 10 column labels (skala penilaian, maximum 100 characters each)
5. WHEN a select, radio, or checkbox field is configured, THE Form_Builder SHALL allow defining between 1 and 50 options (maximum 200 characters per option label)
6. THE Form_Builder SHALL allow marking individual fields as required or optional
7. THE Form_Builder SHALL allow reordering fields within a questionnaire template via drag-and-drop
8. THE Form_Builder SHALL allow duplicating an existing questionnaire template for reuse in future Kegiatan, where the duplicated template is created as an independent copy with a new nama template
9. WHEN a Kuesioner template is linked to a Kegiatan that already has responses, THE Form_Builder SHALL prevent adding, removing, or reordering fields, changing field types, or modifying field options/scale configuration, and SHALL display a notification indicating the template is locked due to existing responses
10. IF an admin attempts to save a template with invalid configuration (missing field labels, scale minimum ≥ maximum, select/radio with zero options, or grid with zero rows or columns), THEN THE Form_Builder SHALL reject the save and display an error message indicating the specific validation failure

### Requirement 4: Pengumpulan Jawaban Kuesioner

**User Story:** As a staf admin IAI Jakarta, I want participants to fill out evaluation forms after events, so that I can collect feedback data for analysis.

#### Acceptance Criteria

1. WHEN a Kuesioner is activated for a Kegiatan, THE Modul_Evaluasi SHALL generate a unique access URL for participants
2. WHEN a Kuesioner is activated for a Kegiatan, THE Modul_Evaluasi SHALL generate a QR code from the access URL for distribution to participants
3. WHEN a participant submits a response, THE Modul_Evaluasi SHALL store all answers as a single Answers_JSON document linked to the Kegiatan and the Kuesioner template
4. WHEN a participant submits a response, THE Modul_Evaluasi SHALL validate that all required fields contain a non-whitespace value with a minimum length of 1 character, and IF any required field is empty or contains only whitespace, THEN THE Modul_Evaluasi SHALL reject the submission and display an error message indicating which fields must be completed
5. THE Modul_Evaluasi SHALL allow one response per participant per Kegiatan, identified by a case-insensitive combination of nama (maximum 200 characters) and email (maximum 150 characters)
6. IF a participant submits a response with a nama and email combination that already exists for the same Kegiatan, THEN THE Modul_Evaluasi SHALL reject the submission and display a message indicating that a response has already been recorded for that participant
7. WHEN a Kuesioner is deactivated, THE Modul_Evaluasi SHALL reject new submissions and display a closed message

### Requirement 5: Tracking Registrasi dan Kehadiran

**User Story:** As a staf admin IAI Jakarta, I want to track registration numbers and actual attendance for each event, so that I can measure conversion rates and plan capacity for future events.

#### Acceptance Criteria

1. THE Modul_Evaluasi SHALL store jumlah Pendaftar for each Kegiatan as a non-negative integer with a maximum value of 99,999
2. THE Modul_Evaluasi SHALL store jumlah Realisasi_Hadir for each Kegiatan as a non-negative integer with a maximum value of 99,999
3. WHEN both Pendaftar and Realisasi_Hadir values are recorded and Pendaftar is greater than 0, THE Modul_Evaluasi SHALL automatically calculate Conversion_Rate as: (Realisasi_Hadir / Pendaftar) × 100, rounded to one decimal place
4. IF Pendaftar is 0 and Realisasi_Hadir is recorded, THEN THE Modul_Evaluasi SHALL display Conversion_Rate as "N/A" instead of performing the calculation
5. IF Realisasi_Hadir exceeds Pendaftar, THEN THE Modul_Evaluasi SHALL accept the value and display a visible warning badge adjacent to the Realisasi_Hadir value
6. WHILE a Kegiatan statusEvent is not "arsip", THE Modul_Evaluasi SHALL allow updating Pendaftar and Realisasi_Hadir values
7. IF a user attempts to update Pendaftar or Realisasi_Hadir for a Kegiatan with statusEvent "arsip", THEN THE Modul_Evaluasi SHALL reject the update and display an error message indicating the Kegiatan is archived
8. WHEN Pendaftar or Realisasi_Hadir is updated, THE Modul_Evaluasi SHALL recalculate Conversion_Rate within 1 second of the update

### Requirement 6: Analytics Evaluasi per Field Type

**User Story:** As a staf admin IAI Jakarta, I want to see analytics computed from questionnaire responses per field type, so that I can understand participant feedback in aggregate.

#### Acceptance Criteria

1. WHEN at least 1 response exists for a scale field, THE Analytics_Dashboard SHALL display: rata-rata (rounded to 2 decimal places), median, distribusi frekuensi per nilai, dan standar deviasi (rounded to 2 decimal places)
2. WHEN at least 1 response exists for a Grid_Field, THE Analytics_Dashboard SHALL display rata-rata per baris (pernyataan) rounded to 2 decimal places dan distribusi frekuensi per kolom untuk setiap baris
3. WHEN responses exist for radio or select fields, THE Analytics_Dashboard SHALL display distribusi frekuensi per opsi (jumlah absolut dan persentase) dalam bentuk chart (bar atau pie)
4. WHEN responses exist for checkbox fields, THE Analytics_Dashboard SHALL display frekuensi pemilihan per opsi (jumlah absolut dan persentase terhadap total responden, multiple selections counted independently)
5. WHEN responses exist for text or textarea fields, THE Analytics_Dashboard SHALL display daftar jawaban teks secara lengkap dengan pagination (maksimal 50 entries per halaman) dan opsi pencarian
6. WHEN Realisasi_Hadir is recorded and greater than 0 for a Kegiatan, THE Analytics_Dashboard SHALL display total jumlah responden dan response rate (responden / Realisasi_Hadir × 100) rounded to 1 decimal place
7. IF Realisasi_Hadir is 0 or not yet recorded for a Kegiatan, THEN THE Analytics_Dashboard SHALL display total jumlah responden and show an indicator that response rate is not available
8. IF no responses exist for a given field, THEN THE Analytics_Dashboard SHALL display a message indicating no data is available for that field instead of empty charts or statistics

### Requirement 7: Export Data Evaluasi

**User Story:** As a staf admin IAI Jakarta, I want to export evaluation data to spreadsheet format, so that I can perform further analysis or share reports with management.

#### Acceptance Criteria

1. THE Modul_Evaluasi SHALL provide export functionality for Kuesioner responses of a selected Kegiatan in CSV format using UTF-8 encoding with BOM
2. THE Modul_Evaluasi SHALL provide export functionality for Kuesioner responses of a selected Kegiatan in XLSX format
3. WHEN exporting responses, THE Modul_Evaluasi SHALL include one row per respondent with each field label as a column header, ordered according to the field order in the Kuesioner template
4. WHEN exporting Grid_Field responses, THE Modul_Evaluasi SHALL expand each row-label into a separate column named "{field_label} - {row_label}" with the selected scale value as the cell content
5. THE Modul_Evaluasi SHALL include a summary sheet in XLSX exports containing: rata-rata and standar deviasi for scale fields, rata-rata per baris for Grid_Field, and distribusi frekuensi per opsi for radio, select, and checkbox fields
6. IF a Kegiatan has zero Kuesioner responses when export is requested, THEN THE Modul_Evaluasi SHALL display an informational message indicating no data is available and SHALL NOT generate a file
7. WHEN export is initiated, THE Modul_Evaluasi SHALL generate the file within 30 seconds for up to 10,000 respondent rows and trigger a file download to the admin's browser

### Requirement 8: Dashboard Analytics Kehadiran dan Kategori

**User Story:** As a management IAI Jakarta, I want to see attendance patterns and category popularity trends, so that I can make data-driven decisions for annual program planning.

#### Acceptance Criteria

1. THE Analytics_Dashboard SHALL display jumlah Kegiatan per Kategori_PPL per bulan dalam bentuk heatmap atau tabel pivot
2. THE Analytics_Dashboard SHALL display rata-rata Conversion_Rate per Kategori_PPL, dibulatkan ke satu angka desimal
3. THE Analytics_Dashboard SHALL display tren Realisasi_Hadir per Kategori_PPL per bulan dalam bentuk line chart
4. THE Analytics_Dashboard SHALL allow filtering data by rentang tanggal (tahun, semester, atau custom range dengan minimum 1 bulan dan maksimum 5 tahun)
5. WHEN no filter is applied, THE Analytics_Dashboard SHALL display data for the current calendar year as the default period
6. THE Analytics_Dashboard SHALL display ranking Kategori_PPL berdasarkan total peserta hadir dalam periode yang dipilih, diurutkan dari tertinggi ke terendah
7. THE Analytics_Dashboard SHALL display perbandingan year-over-year untuk setiap Kategori_PPL meliputi: total Realisasi_Hadir, jumlah Kegiatan, dan rata-rata Conversion_Rate, beserta persentase perubahan dari tahun sebelumnya
8. IF no Kegiatan data exists for the selected period or Kategori_PPL, THEN THE Analytics_Dashboard SHALL display an empty state message indicating that no data is available for the selected criteria

### Requirement 9: Analisis Pola untuk Perencanaan Program Tahunan

**User Story:** As a management IAI Jakarta, I want the system to analyze historical patterns and recommend optimal scheduling, so that I can plan next year's PPL program based on data.

#### Acceptance Criteria

1. WHEN at least 12 months of historical data exist for a Kategori_PPL, THE Analytics_Dashboard SHALL display the top 3 bulan dengan rata-rata Realisasi_Hadir tertinggi per Kategori_PPL, diurutkan dari tertinggi ke terendah, berdasarkan seluruh data historis yang tersedia
2. THE Analytics_Dashboard SHALL display rekomendasi jadwal Program_Tahunan yang menampilkan untuk setiap Kategori_PPL: bulan-bulan yang direkomendasikan (bulan dengan rata-rata Realisasi_Hadir di atas median keseluruhan bulan untuk kategori tersebut) beserta rata-rata Realisasi_Hadir dan Conversion_Rate pada bulan tersebut
3. WHEN at least 2 years of historical data exist for a Kategori_PPL, THE Analytics_Dashboard SHALL display tren minat berupa persentase perubahan year-over-year dari total Realisasi_Hadir, dan melabeli tren sebagai "pertumbuhan" jika perubahan > 0% atau "penurunan" jika perubahan < 0%
4. THE Analytics_Dashboard SHALL display skor popularitas per Kategori_PPL dalam skala 0–100, dihitung dengan formula: (rata-rata Realisasi_Hadir yang dinormalisasi × 40%) + (rata-rata Conversion_Rate yang dinormalisasi × 30%) + (rata-rata skor evaluasi yang dinormalisasi × 30%), di mana normalisasi menggunakan min-max scaling terhadap seluruh Kategori_PPL
5. THE Analytics_Dashboard SHALL allow exporting rekomendasi Program_Tahunan dalam format PDF atau XLSX
6. IF kurang dari 12 bulan data historis tersedia untuk suatu Kategori_PPL, THEN THE Analytics_Dashboard SHALL menampilkan indikator bahwa data belum mencukupi untuk analisis pola pada kategori tersebut dan tidak menampilkan rekomendasi bulan untuk kategori tersebut

### Requirement 10: Analisis Performa Narasumber

**User Story:** As a staf admin IAI Jakarta, I want to see speaker performance analytics based on evaluation scores, so that I can identify top-performing speakers and make informed assignment decisions.

#### Acceptance Criteria

1. WHEN evaluation responses are linked to a Kegiatan with assigned Narasumber, THE Analytics_Dashboard SHALL calculate rata-rata skor evaluasi per Narasumber by averaging all Likert_Scale and Grid_Field numeric values from the linked Kuesioner responses
2. THE Analytics_Dashboard SHALL display ranking Narasumber berdasarkan rata-rata skor evaluasi keseluruhan (across all Kegiatan within the selected date range filter), sorted descending from highest to lowest score
3. THE Analytics_Dashboard SHALL display jumlah Kegiatan yang telah diselesaikan (Kegiatan with status archived or past tanggal selesai) oleh setiap Narasumber beserta total SKP yang telah diberikan
4. WHEN a Narasumber has participated in 2 or more Kegiatan, THE Analytics_Dashboard SHALL display tren skor evaluasi per Kegiatan in chronological order based on tanggal selesai Kegiatan
5. THE Analytics_Dashboard SHALL allow filtering performa Narasumber berdasarkan Kategori_PPL
6. IF a Narasumber has no linked evaluation responses, THEN THE Analytics_Dashboard SHALL display the Narasumber in the list with a "belum ada data evaluasi" indicator and exclude them from ranking calculations
7. WHEN displaying rata-rata skor evaluasi per Narasumber, THE Analytics_Dashboard SHALL also display jumlah responden yang mendasari perhitungan skor tersebut
