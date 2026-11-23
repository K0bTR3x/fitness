# Qurulum: Supabase + Netlify (pulsuz, ~15 dəqiqə)

## 1. Supabase (məlumat bazası və giriş)
1. https://supabase.com → "Start your project" → GitHub və ya e-poçtla daxil ol.
2. "New project": ad `fitness`, region **Frankfurt (eu-central-1)**, güclü DB şifrəsi (yadda saxla). Plan: Free.
3. Sol menyu → **SQL Editor** → "New query":
   - `supabase/migrations/0001_init.sql` faylının məzmununu yapışdır → **Run**.
   - Yeni query: `supabase/seed.sql` → **Run** (menyu, ərzaqlar, məşq planı).
   - Yeni query: `supabase/migrations/0002_grants.sql` → **Run** (cədvəl icazələri).
4. **Authentication → Sign In / Providers → Email**: "Enable Email provider" açıq, "Confirm email" açıq qala bilər. **Email OTP Length = 6** et (standart 8-dir).
5. Şablonu dəyişmək üçün Supabase SMTP tələb edir. Pulsuz Resend qoş: resend.com-da tətbiqə girəcəyin e-poçtla qeydiyyatdan keç, API key yarat. Supabase → **Authentication → Emails → SMTP Settings**: Sender `onboarding@resend.dev`, Host `smtp.resend.com`, Port `465`, Username `resend`, Password = API key. (Test rejimi yalnız öz e-poçtuna göndərir, bu kifayətdir.)
6. **Authentication → Emails → Templates**: həm **Confirm signup**, həm **Magic Link** şablonunu `supabase/email-template.html` ilə əvəz et (ilk girişdə Confirm signup gedir) (məktubda link yox, 6 rəqəmli kod gəlsin).
7. **Project Settings → API**: `Project URL` və `anon public` açarını kopyala (növbəti addımda lazımdır).

## 2. Kod GitHub-da
Netlify kodu GitHub-dan götürür. GitHub-da boş, **private** repo yarat (məs. `fitness-dashboard`) və mənə adını yaz, kodu ora mən göndərim.

## 3. Netlify (hostinq)
1. https://app.netlify.com → GitHub ilə daxil ol → "Add new site → Import an existing project" → repo-nu seç.
2. Build ayarları `netlify.toml`-dan özü gəlir.
3. **Site configuration → Environment variables**:
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon public açar
4. "Deploy". Ünvan belə olacaq: `https://<ad>.netlify.app`.

## 4. iPhone-da quraşdır
1. Safari-də saytı aç → **Paylaş** → **Ana ekrana əlavə et**.
2. Ana ekrandakı ikondan aç → e-poçtunu yaz → gələn 6 rəqəmli kodu yaz.
3. İlk girişdən sonra Supabase-də **Authentication → Sign In / Providers → "Allow new users to sign up"** söndür. Beləliklə səndən başqa heç kim hesab aça bilməz.

Pulsuz Supabase layihəsi 7 gün heç bir sorğu olmasa dayanır. Hər gün çəki yazdığın üçün bu baş verməməlidir; olsa, paneldə "Restore" bir düymədir, məlumat itmir.

## 5. Bildirişlər (push)
Açarlar layihə fayllarında `fitness/gizli/bildiris-acarlari.txt` faylındadır (GitHub-da yoxdur).
1. **SQL Editor** → `supabase/migrations/0003_push.sql` → **Run**.
2. **Edge Functions** → **Deploy a new function** → **Via Editor**. Adı `push-tick` olsun (bizdə dashboard `bright-task` adı verdi; tətbiq `VITE_PUSH_FUNCTION` ilə dəyişir, standart `bright-task`). `supabase/functions/push-tick/index.ts` faylını yapışdır → **Deploy**.
3. Funksiyanın **Settings** bölməsində **Verify JWT** (Enforce JWT verification) ayarını **söndür** → Save. Funksiya yoxlamanı özü edir.
4. **Edge Functions → Secrets**: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `CRON_SECRET` (dəyərlər açar faylındadır).
5. Açar faylının sonundakı cron SQL-ini **SQL Editor**-da **Run** et (hər 5 dəqiqədən bir yoxlayır).
6. iPhone: tətbiqi **ana ekrandakı ikondan** aç → Bu gün ekranının aşağısında **Bildirişləri aç** → İcazə ver → **Sınaq göndər**.

Cədvəl (Bakı vaxtı): 07:15 çəki, yemək saatları (07:30, 10:30, 13:00, 16:30, 20:15 — yedinsə gəlmir), iş günləri su (09:30–17:30) və hərəkət (11:30, 15:30), məşq günü 18:30, 21:30 Günü bağla (bağlanıbsa gəlmir).

## 6. Yeməyi dəyiş (menyu dəyişiklikləri)

1. **SQL Editor** → `supabase/migrations/0004_meal_overrides.sql` → **Run**.
2. Tətbiqdə **Bu gün → Dəyiş** ilə yeməyi əvəz et. "Yalnız bu gün" və ya "Hər <həftə günü>" seçilə bilər. Alış-veriş siyahısı özü yenilənir.
