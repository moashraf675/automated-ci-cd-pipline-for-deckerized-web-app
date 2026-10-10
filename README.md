# تطبيق مهام بسيط

تطبيق ويب عربي لإدارة المهام اليومية، بواجهة HTML/CSS/JavaScript وخادم Node.js باستخدام Express. المهام تُحفظ في المتصفح، والتطبيق مجهز للتشغيل داخل Docker.

## التشغيل محليًا

يتطلب Node.js 22 أو أحدث:

```bash
npm install
npm start
```

افتح <http://localhost:3000>.

## الاختبارات

```bash
npm test
```

## التشغيل باستخدام Docker

```bash
docker build -t task-board .
docker run --rm -p 8080:3000 task-board
```

ثم افتح <http://localhost:8080>.

## النشر إلى EC2

أضف الأسرار التالية إلى **Settings → Secrets and variables → Actions** في
مستودع GitHub:

- `DOCKERHUB_USERNAME`: اسم مستخدم Docker Hub.
- `DOCKERHUB_TOKEN`: Docker Hub access token بصلاحية القراءة والكتابة.
- `EC2_HOST`: عنوان IP العام أو اسم DNS العام لخادم EC2.
- `EC2_USER`: اسم مستخدم SSH فقط، مثل `ec2-user` على Amazon Linux 2023؛ لا تضف `@` أو عنوان الخادم.
- `EC2_SSH_KEY`: المحتوى الكامل للمفتاح الخاص بصيغة PEM الذي يتيح الدخول إلى الخادم.

أنشئ مستودعًا عامًا باسم `cipp` في Docker Hub تحت حسابك. عند كل push إلى
`main`، يجري GitHub Actions الاختبارات، ويبني الصورة ويرفعها إلى
`<DOCKERHUB_USERNAME>/cipp` بوسمي commit SHA و`latest`، ثم يسحب EC2 صورة الـSHA
من Docker Hub ويعيد تشغيل الحاوية. عمليات pull request تشغّل الاختبارات والبناء
فقط ولا تستخدم أسرار النشر. بما أن مستودع الصورة عام، لا يحتاج EC2 إلى تسجيل دخول
إلى Docker Hub.

تأكد من تثبيت Docker وتشغيله على الخادم، ومن أن مستخدم SSH يستطيع تشغيل أوامر
Docker دون `sudo` (أعد تسجيل الدخول بعد إضافته إلى مجموعة `docker`). اسمح باتصالات
SSH على المنفذ 22 من عناوين GitHub Actions runner، وافتح TCP على المنفذ 80
للمستخدمين الذين يحتاجون إلى الموقع.
