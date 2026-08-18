# نتائج الفحص من المتصفح

تاريخ الفحص: 2026-08-18.

## GitHub

المستودع العام هو `Ryan418518/voxtract` على الفرع `main`. آخر commit ظاهر من المتصفح هو `b0709ad` بعنوان `fix: retry Gemini 503 errors with stable fallback models`. المستودع يحتوي على مجلد `artifacts` وملفات مساحة عمل pnpm، ولا توجد Releases منشورة.

## Expo/EAS

الحساب المسجل في المتصفح هو `ryanam​​ir418`، والمشروع المرتبط بالمستودع هو `voxtract` بمعرّف Expo `voxtract-7gyjyhqvuy8fjy9-kcah`. صفحة المشروع تعرض أن المستودع المرتبط هو `Ryan418518/voxtract`.

صفحة Builds تعرض بناءين سابقين على Android، وكلاهما فشل خلال نحو 19 ثانية. البناء المفتوح للتفاصيل هو `558a88a2-7c5e-4c02-a0d4-b137ebcf4661`، من commit `3de9e4a` على `main` وبروفايل `preview` وبيئة `preview`. الحالة `Errored`، ومدة البناء الكلية 25 ثانية. صفحة التفاصيل تعرض قسم Logs لكنه يحتاج فتح/توسيع من واجهة Expo لاستخراج النص الكامل.

المطلوب التالي: فتح سجل Logs أو استخدام زر Build from GitHub لإطلاق بناء جديد بعد رفع الإصلاحات إلى GitHub، ثم متابعة الحالة حتى نجاح البناء والحصول على رابط artifact.

## سجل البناء السابق

بعد توسيع قسم Logs في المتصفح، ظهر أن البناء السابق لم يصل إلى Gradle أو كود التطبيق؛ فقد فشل في مرحلة `Install dependencies` لأن الأمر `pnpm install --frozen-lockfile` خرج برمز 1. هذا يطابق النقص الذي تم إصلاحه محلياً عبر تحديث `pnpm-lock.yaml` وفق `artifacts/mobile/package.json` وترقية إصدارات Expo المتوافقة.
