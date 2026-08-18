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

## نموذج البناء الجديد

بعد تأكيد المستخدم، فُتح نموذج `Start a build from GitHub`. Expo يؤكد أن المشروع المرتبط هو `Ryan418518/voxtract`، لكنه يحذر بأن الحساب لا يملك build credentials مخزنة في EAS، ولذلك قد يفشل البناء ما لم تتوفر credentials محلية قابلة للوصول من مستودع GitHub. النموذج يطلب اختيار Base directory وPlatform وGit ref وEAS Build profile.

## إعداد البناء الجاري

في نموذج Expo تم اختيار منصة `Android` وتحديد Git ref على commit الإصلاحات `963dcfb`. بقي اختيار EAS Build profile، والمقصود هو `preview` لأن `eas.json` يضبط هذا البروفايل لإخراج APK (`buildType: apk`).

## تصحيح مرجع Git

رفض نموذج Expo الاختصار `963dcfb` باعتباره غير معروف. تم استخراج SHA الكامل من المستودع: `963dcfb6f83fff0214d69130233676682f155af2`، وأُدخل في النموذج بدلاً من الاختصار.

## تعذر إطلاق البناء بالـSHA

بعد إرسال الطلب، رفض Expo إطلاق build برسالة تفيد بأن حساب Expo لا يملك عضواً متصلاً بحساب GitHub لديه صلاحية admin على المستودع. بما أن commit `963dcfb` أصبح الآن رأس فرع `main`، سيُعاد الطلب باستخدام Git ref `main` لتجاوز تحقق commit المباشر الذي يعتمد على اتصال GitHub، مع بقاء المصدر هو نفس الإصلاحات المدفوعة.

## صلاحيات GitHub App

تم فتح صفحة GitHub الرسمية لتثبيت Expo App على حساب `Ryan418518`. الصفحة تعرض صلاحيات قراءة metadata وصلاحيات قراءة/كتابة على actions وadministration وchecks وcode وcommit statuses وdeployments وissues وpull requests وrepository hooks وworkflows. قسم Repository access يعرض خيار `All repositories` مفعّلاً، ما يشمل `Ryan418518/voxtract`. سيتم التحقق من زر Save في أسفل الصفحة لتطبيق/تجديد الإعدادات.

## نتيجة حفظ GitHub App

تم التحقق من أن `All repositories` هو الخيار المحدد وأن المستودع مشمول بصلاحيات Expo App. تم الضغط على Save، ولم تظهر رسالة خطأ من GitHub. بما أن Expo قد يستمر في رفض البناء، فالاحتمال المتبقي هو عدم ربط حساب GitHub `Ryan418518` بعضوية حساب Expo `ryanam​​ir418`، وليس نقص صلاحيات المستودع.

## إعدادات حساب Expo

صفحة Account settings في Expo تعرض User settings وConnections لخدمات أخرى فقط، ولا تعرض اتصال GitHub أو خيار ربط حساب GitHub. لذلك لا يوجد إجراء إضافي من إعدادات حساب Expo نفسها؛ المشكلة تخص تحقق Expo من عضوية GitHub المرتبطة بالمشروع.

## نتيجة إعادة المحاولة بعد تحديث الصلاحيات

أُعيد إطلاق نموذج البناء من `main` مع Android و`preview` بعد حفظ إعدادات GitHub App. Expo رفض الطلب مرة أخرى بالرسالة نفسها: `This Expo account doesn't have a member with a GitHub user that has admin access to this repository.` لذلك لا يمكن لمسار Build from GitHub المتصفح أن يبدأ البناء رغم أن GitHub App مثبت على حساب المالك وبصلاحيات All repositories.

المسار البديل هو استخدام EAS CLI بتوكن Expo للحساب، أو إكمال البناء محلياً؛ مسار GitHub يحتاج ربط عضو Expo بحساب GitHub admin لا توفره هذه الواجهة.

## توكن EAS المؤقت

تم إنشاء Personal Access Token باسم `Voxtract EAS build temporary` من حساب Expo، وحالته Active. لم تُحفظ قيمة التوكن في ملفات المشروع أو التقرير؛ ستُستخدم فقط داخل جلسة البناء ثم يُلغى التوكن بعد الانتهاء.

## بناء EAS السحابي الجاري

لأن مشروع Expo القديم كان غير قابل للبناء عبر GitHub، ربطت CLI التطبيق المحلي بمشروع EAS جديد تحت الحساب: `@ryanamir418/mobile`، بمعرّف UUID `715b00ed-c05f-4364-aadc-2ab3e925ca6e`. أُطلق البناء السحابي بنجاح عبر بروفايل `preview`، ورابطه:

`https://expo.dev/accounts/ryanamir418/projects/mobile/builds/ef95aa54-edc1-49aa-a219-3a76d2192529`

البناء أخذ commit `963dcfb`، نجح في Install dependencies وPrebuild وPrepare credentials وBundle JavaScript، وهو حالياً في مرحلة `Run gradlew`.

## تقدم البناء

صفحة البناء `https://expo.dev/accounts/ryanamir418/projects/mobile/builds/ef95aa54-edc1-49aa-a219-3a76d2192529` تعرض الحالة `Build in progress` بعد 4 دقائق تقريباً. مرحلة `Run gradlew` مستمرة، وقد تجاوزت إعداد CMake وبدأت مهام Kotlin/Java وReact Native الأصلية؛ لا توجد أخطاء في السجل حتى آخر تحديث، بل تحذيرات deprecation فقط.

## آخر تقدم Gradle

بعد نحو 13 دقيقة، البناء ما زال `IN_PROGRESS` لكنه وصل إلى مهام متقدمة مثل `:app:validateSigningRelease` و`:app:writeReleaseAppMetadata` وعمليات lint وCMake النهائية. لا يظهر خطأ؛ السجل يعرض تحذيرات AndroidManifest وdeprecation فقط.
