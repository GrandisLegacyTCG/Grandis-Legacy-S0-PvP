# Grandis Legacy Season 0 PvP RC41 — F18/F19 Stabilization Handoff

Tanggal: 21 November 2026. Baseline untuk merge: PvP Season 0 RC41 **F15 Interactions** dari 21 November 2026. Donor: `Grandis_Legacy_VS_AI_Season0_RC41_Part7_F18_F19_ScrollSwapHotfix_2026-11-21_STANDALONE.zip`. Repository tujuan: `GrandisLegacyTCG/Grandis-Legacy-S0-PvP` (`main`). **Jangan merge ke Season 1.**

## Integrasi

1. **Search/Return -> Hand -> Card Played**: perpindahan kartu hasil pemilihan dengan commit token sekarang dikaitkan ke *source action* tepat di jurnal `pvpActionEventsBySide`, bukan hanya jurnal presentation. Proyeksi `server/viewer-safe.mjs` mengizinkan detail kartu dari Main Deck hanya ketika ada `CARD_PUBLIC_PICKUP` untuk kombinasi action ID + actor side + source card + card ID yang sudah benar-benar committed. Draw biasa tetap private. Discard -> Hand menggunakan identitas dari Discard yang sudah terbuka. Pemain sendiri dan lawan mendapat notifikasi untuk pickup yang memang diumumkan.
2. **F18 Card Search popup**: hanya grid kartu yang melakukan scrolling; `choice_id`/`commit_token` mempertahankan posisi scroll saat snapshot WebSocket membuat objek `pending` baru. Footer dan tombol konfirmasi tetap terlihat.
3. **F19 Swap**: serangan yang mengharuskan *target* Swap (Soul Blast Shot) memilih partner legal di engine server dan tidak lagi meninggalkan popup pilihan yang bisa membuat pertandingan macet; hasil atau pembatalan diteruskan **hanya ke pemain yang Hero-nya terdampak**. Aksi Swap opsional tetap menampilkan tombol destinasi yang legal beserta SKIP; tombol overlay lama yang duplikat disembunyikan.
4. Kartu, AI logic, authority protocol, ACK/revision, reconnect, Room2 fallback, musik, asset sharing dan Build ID RC41 lama tetap dipertahankan. Browser script cache-buster diperbarui pada tiga berkas yang berubah; `.br`/`.gz` backend diregenerasi dari source terbaru.

## Verifikasi lokal

- `npm run check:rc41` PASS: 20/20 gameplay regression, donor Part7 focused 43/43, dua-seat network/masked Search, F19 11 focused checks, Search/Return Card Played kedua seat, dan optional Swap melalui authority Seat 1/2 (SWAP/SKIP) serta recipient-only Swap notice kedua seat.
- `node scripts/run-rc41-release-check.mjs` PASS 50/50 independent historical/multiplayer tests.
- SHA audit tiga modul donor statis benar; precompressed `.br`/`.gz` cocok dengan source.
- Chromium dalam container terhalang `net::ERR_BLOCKED_BY_ADMINISTRATOR`; UI visual penuh dan pertandingan 2-browser produksi belum dibuktikan. Perbaikan ini **belum berarti live match dijamin tanpa macet**.

## Cara upload manual

**Disarankan full backend**: gunakan ZIP FULL_BACKEND untuk mengganti source repo Season 0 PvP. PATCH_ONLY hanya boleh ditumpuk di atas backend F15 Interactions (21 November 2026), bukan baseline RC40 atau patch lain. Commit/push/deploy dilakukan manual oleh pemilik.

Upload **backend lebih dulu**, lalu merge ZIP ROOT_ONLY website yang hanya berisi folder `/pvp/` ke `Grandis-Legacy-S0-Website`. Gunakan URL WSS di `pvp/config.js` yang sudah ada. Tes kedua player, terutama Search / Return / Response / Mana Payment / optional Swap / Soul Blast / reconnect / Card Played. Jangan upload `node_modules/`.
