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

## النشر إلى Docker Hub

أضف السرّين `DOCKERHUB_USERNAME` و`DOCKERHUB_TOKEN` إلى إعدادات المستودع في
GitHub من **Settings → Secrets and variables → Actions**. عند كل عملية push،
ينشر سير العمل الصورة باسم `<DOCKERHUB_USERNAME>/yomy-task-app:<commit-sha>`.
أما عمليات pull request فتُجري البناء والاختبارات فقط دون استخدام بيانات الاعتماد.
