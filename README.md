# Spiver Color — калькулятор колорантов CPSCOLOR

Браузерный калькулятор формул колорантов для системы CPSCOLOR 4.12 (Spiver 26-10-2011) на базе зашифрованной FoxPro-БД.

**Live**: https://catolseo.github.io/spiver-color/

## Что делает

Выбираете линию (REOSAN / INT / EXTINT / SILICATI / VERLAX / HIDROLAX / ...) → продукт → цвет → объём. На выходе — таблица колорантов с каплями, миллилитрами и граммами, с учётом плотности каждого пигмента и плотности выбранной базы.

- 51 177 формул из 56 продуктов в 14 линиях
- 16 колорантов системы Spiver (AXX, B, C, D, E, F, G, I, KX, LA, R, T, V, BG, GY, YG, HS)
- Базы, скоупированные по (продукт, продукт-линия): P PASTELLO, M MEDIA, ST SEMITRASPARENTE, T TRASPARENTE, GRIGIA, BV, VERLAX ANTIQUE, HIDROWOOD, HIDROFLATTING и т.д.
- 1 капля = 31.240 / 96 ≈ 0.3254 мл (CPSCOLOR 1/96 EU fl.oz.)

## Формула пересчёта

Каждая формула в БД задана для конкретной банки `CAN_ID` (с объёмом `NOM_Q`):

```
drops_scaled = formula_amount × target_volume_ml / can.ml
colorant_ml  = drops_scaled × drop_ml
colorant_g   = colorant_ml × colorant.density
```

## Структура

- `index.html`, `app.js`, `styles.css` — UI
- `data.js` — ядро (колоранты, базы, банки, каталог продуктов) ~18 KB
- `formulas/p<N>.js` — формулы линии (14 файлов, загружаются лениво при выборе линии)
- `tools/extract_dbf.py` — парсер `C:\G_SPIVER\*.dbf` (dBase III, cp850) → JS

## Переэкспорт базы

При обновлении CPSCOLOR перегенерируйте данные:

```
python tools/extract_dbf.py
```

Требуется установленный CPSCOLOR (папка `C:\G_SPIVER`).

## Исходные файлы БД

```
C:\G_SPIVER\
  PRODUCTS.DBF           14 линий краски (REOSAN, INT, EXTINT, SILICATI, ARTHE, ...)
  PROD000N\SUBPRODS.DBF  продукты линии
  BASES.DBF              базы (scoped: PROD_KEY + SUBP_KEY)
  CANS.DBF               размеры банок (0.375 LT, 1 LT, 2.5 LT, 5 LT, 15 LT, 25 KG, ...)
  CNTS.DBF               16 колорантов
  COLORKEY.DBF           3130 кодов цветов (KEY1/KEY2/KEY3)
  <prod>\<subprod>\FRM.DBF  формулы
```

Поле `FRM.FORMULA` — строка вида `"cid,amount,cid,amount,..."` где `cid` — `CNTS.ID`, `amount` — количество единиц-долей (1 ед = `PRODUCTS.UNIT / PRODUCTS.FRACTION` мл).
