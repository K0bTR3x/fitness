# Fitness Dashboard (v0.1)

Rashadın 12 həftəlik fitness proqramı üçün şəxsi PWA. Vue 3 + Vite + TypeScript + Pinia + Tailwind 4, məlumat Supabase-də, hostinq Netlify-da (hər ikisi pulsuz plan).

## Bu versiyada nə var
- Giriş: e-poçta 6 rəqəmli kod (şifrəsiz)
- Bu gün: çəki, kalori halqası, makrolar, növbəti yemək, su stəkanları, bugünkü məşq, növbəti checkpoint, kiçik addım
- Tez qeyd (+): çəki, su (250/500/750 ml, geri al), yemək ("Yedim" + plandan kənar)
- Səhər ölçüsü: rəqəm klaviaturası, bel (həftəlik), yuxu
- Təqvim: həftə şeridi, saat-saat günün planı (çiy / quru / hazır nişanları), keçmiş gündə plan və fakt
- Zal rejimi: şəkilli hərəkət, böyük rəqəmlər, set arası taymer (bitmə vaxtına görə), −15/+15, "Geri al" 5 san, ekran sönmür, yüngül gündə siyahı
- Günü bağla: plan hazır işarəli, porsiya ½–1½, yemədim, başqa yemək, kənarda yedim, + əlavə, uyğun gün qiymətləndirməsi, sabahın planı
- Açıq və qaranlıq rejim

İnkişaf və Mükafatlar ekranlarının tam dizaynı növbəti versiyadadır (indi sadə siyahı).

## Komandalar
```
npm install
npm run dev          # lokal
npm test             # 9 test: menyu cəmləri, uyğunluq, həftə, ortalama
npm run build        # Netlify üçün PWA → dist/
npm run build:demo   # Supabase-siz önizləmə, bir HTML → dist-demo/
```
`.env` faylı yoxdursa, tətbiq avtomatik demo rejimində işləyir (məlumat brauzerdə).

## Məlumat
- `scripts/build_seed.py fitness_12hefte.xlsx` → `src/data/seed.json` + `supabase/seed.sql` (menyu, ərzaq, məşq).
- `supabase/migrations/0001_init.sql` cədvəllər, RLS, checkpoint qaydası (7/7 çəki, həftəlik ortalama ≤ hədəf, status yalnız irəli).
- `supabase/tests/local_checks.sql` sxemin lokal PostgreSQL yoxlaması.

Hərəkət şəkilləri: free-exercise-db (Unlicense). Şəkillərin özündə bodybuilding.com loqosu var; şəxsi istifadə üçün problem deyil, tətbiqi ictimai etsən dəyişmək lazımdır.

Qurulum addımları: `QURULUM.md`.
