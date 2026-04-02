

# خطة بناء أداة NLG Font Updater - تطبيق ويب تفاعلي

## ملخص
تطبيق ويب يُضمَّن فيه ملف الإحداثيات (`gb_3.txt`) وصورة الخط القديمة (`gb_3.png`) كمرجع ثابت. المستخدم يرفع فقط خط TTF جديد، والأداة تولّد صورة خط جديدة + ملف إحداثيات محدّث.

## تنسيق NLG المُكتشف

```text
Header:
  NLG Font Description File
  Version 1.11
  Font "NAME" SIZE color R G B
  PageSize 1024 PageCount 19 TextType color Distribution english
  Height 24 RenderHeight 28 Ascent 24 RenderAscent 21 IL 0
  CharSpacing 10 LineHeight 15

Glyph lines:
  Glyph <CHAR_OR_UNICODE> Width <col1> <col2> <col3> <x1> <y1> <x2> <y2> <page>
  
Footer: END
```

- 1697 أحرف (سطور 7-1702)، 19 صفحة بحجم 1024x1024
- تشمل ASCII، CJK، وأحرف عربية (Unicode 65xxx = Arabic Presentation Forms)

## خطوات التنفيذ

### 1. تضمين الملفات المرجعية في المشروع
- نسخ `gb_3.txt` إلى `public/fonts/gb_3.txt`
- نسخ `gb_3.png` إلى `public/fonts/gb_3.png`

### 2. بناء محلل NLG (NLG Parser)
- ملف `src/lib/nlgParser.ts`
- يقرأ الـ Header ويستخرج: PageSize, PageCount, Height, Ascent, CharSpacing, LineHeight
- يقرأ كل سطر Glyph ويستخرج: unicode/char, width params, bounding box (x1,y1,x2,y2), page number
- يُرجع مصفوفة من الـ Glyphs مع بيانات الـ Header

### 3. بناء مولّد الخط (Font Renderer)
- ملف `src/lib/fontRenderer.ts`
- يستخدم **opentype.js** لقراءة ملف TTF في المتصفح
- يستخدم **Canvas API** لرسم كل حرف على صفحات 1024x1024
- يعيد ترتيب الأحرف بنفس ترتيب الملف القديم
- يحسب الـ bounding box الجديد لكل حرف بناءً على metrics الخط الجديد
- يولّد ملف إحداثيات جديد بنفس التنسيق تماماً

### 4. بناء واجهة المستخدم
- ملف `src/pages/Index.tsx` + مكونات فرعية
- **منطقة رفع TTF**: زر رفع ملف واحد فقط
- **معاينة**: عرض صفحات الصورة المولّدة
- **تحميل**: زرّان لتحميل الصورة الجديدة (.png) وملف الإحداثيات (.txt)
- **مقارنة**: عرض الصورة القديمة بجانب الجديدة

### 5. المكتبات المطلوبة
- `opentype.js` — قراءة TTF واستخراج Glyphs
- Canvas API (مدمج في المتصفح) — رسم الأحرف

## التفاصيل الفنية

**خوارزمية الترتيب (Packing):**
1. قراءة قائمة الأحرف من الملف القديم بالترتيب
2. لكل حرف: رسمه بالخط الجديد على Canvas مؤقت لقياس أبعاده
3. ترتيب الأحرف في صفوف على صفحات 1024x1024 (row packing)
4. تسجيل الإحداثيات الجديدة (x1, y1, x2, y2, page)
5. توليد ملف TXT جديد بنفس تنسيق NLG

**معالجة الأحرف العربية:**
- الأحرف العربية موجودة بالفعل كـ Unicode Presentation Forms (65xxx) في الملف القديم
- opentype.js يدعم رسمها مباشرة بدون تشكيل إضافي

