# Spiver Color — калькулятор колорантов CPSCOLOR

Браузерный калькулятор формул колорантов для итальянской системы тонирования **CPSCOLOR 4.12** производителя **Spiver** (релиз БД 1.30 от 26-10-2011). Работает без сервера — чистый HTML/CSS/JS.

**Живая версия:** https://catolseo.github.io/spiver-color/

## Для кого

- **Маляры и тонировщики** — нужно смешать конкретный цвет Spiver, но тинтометра нет под рукой: калькулятор даёт точную рецептуру в каплях, мл и граммах для любого объёма.
- **Магазины ЛКМ** — быстро проверить формулу без запуска тяжёлого ColorLAB / CorobSHOP.
- **Техподдержка** — свериться с официальной формулой при расхождении.

## Что умеет

1. **Выбор линии краски** — 14 линий Spiver: REOSAN (антиплесневые), INT / EXTINT (интерьер/суперлавабили), SILICATI (DEKORSILICAT), SILOSSANI (PERFECTO), CALCE (ETRUSCA, TONO ANTICO), PLASTICI (SPIVERQUARZ, BUCCIATO, ELASTOCRIL), ARTHE (декоративные: COCCIOPESTO, ENCAUSTO, STUCCOMARMO, ZEPHYRO, TRAVERTINO и др.), ALCHIDICI (VERLAX), ANTIRUGGINI (CROMAR, CROMARZINC, CROMARITE), SMALTI (HIDROLAX, HIDROSATIN), FONDI (METALPRIMER), LEGNO (HIDROWOOD, HIDROFLATTING), SPECIALI (MULTIGUM, BLOCCAFUMO, TOP EPOXY, SPIVERCEM).
2. **Выбор продукта** внутри линии (56 штук всего).
3. **Фильтрация цветов** — по коллекции (AMBIANCE, SICILY COLLECTION и т.п.) или по коду/названию (OW11P, SWAN WING, RAL, NCS…).
4. **Предпросмотр цвета** — квадратик с реальным оттенком из лабораторных замеров CIE XYZ D65/2°. Фон страницы также подкрашивается под выбранный цвет.
5. **Пересчёт на любой объём** — литры, миллилитры, килограммы, граммы. Автоподстановка плотности базы.
6. **Результат** — таблица со всеми колорантами: код, полное имя, количество капель, миллилитры, граммы (с учётом индивидуальной плотности каждого пигмента).

## Цифры

| | |
|---|---|
| Всего формул | **51 177** |
| Линий краски | **14** |
| Продуктов | **56** |
| Колорантов Spiver | **16** (AXX, B, C, D, E, F, G, I, KX, LA, R, T, V, BG, GY, YG, HS) |
| Баз (scoped per product) | **156** уникальных |
| Размеров банок | **18** (0.375 / 0.5 / 0.75 / 1 / 2.5 / 4 / 5 / 10 / 13 / 14 / 15 / 16 / 20 LT, 1 / 25 / 30 KG и т.д.) |
| Кодов цветов (COLORKEY) | 3 130 |
| 1 капля | **0.3254 мл** (CPSCOLOR EU fl.oz. / 96) |

## Покрытие цвета

| Источник | Формул | % |
|---|---:|---:|
| Реальные замеры (CIE XYZ → sRGB из БД) | 46 356 | 90.6% |
| Синтезированный предпросмотр (линейный микс колорантов) | 4 823 | 9.4% |

Поле `R_MON/G_MON/B_MON` в релизе 1.30 всегда −1 (монитор-RGB не пересчитывался в ColorLAB). Основной источник — `X_02/Y_02/Z_02` с преобразованием в sRGB через матрицу D65. Для формул без измерений цвет аппроксимируется как взвешенный линейный микс RGB‑оттенков колорантов поверх белой подложки, с учётом доли пигмента в банке.

## Формула пересчёта объёма

Каждая формула в БД задана для конкретной банки `CAN_ID` с номинальным объёмом `NOM_Q`:

```
drops_scaled = formula_amount × target_volume_ml / can.ml
colorant_ml  = drops_scaled × drop_ml
colorant_g   = colorant_ml × colorant.density
```

Для банок-по-массе (`KG`) масштабирование идёт по массе: `target_g / can.g` вместо `target_ml / can.ml`.

Базы скоупированы по (PROD_KEY, SUBP_KEY) — одна и та же ID-шка (например, `1 = P PASTELLO`) означает разные физические базы в разных продуктах. В JS резолвится через цепочку:

```
bases["prd:sp:id"]  →  bases["prd::id"]  →  bases["::id"]
```

## Структура проекта

| Файл | Что |
|---|---|
| `index.html` | разметка + точки монтажа UI |
| `styles.css` | тёмно-синяя фирменная стилистика Spiver, адаптивная сетка |
| `app.js` | вся логика: загрузка данных, фильтры, расчёт |
| `data.js` | ядро (колоранты, базы, банки, каталог продуктов) ~18 KB |
| `formulas/p<N>.js` | формулы одной линии — 14 файлов, ленивая загрузка по клику |
| `tools/extract_dbf.py` | парсер `C:\G_SPIVER\*.dbf` (dBase III, cp850) → JS |

## Переэкспорт базы

Если у вас более свежий релиз Spiver / CPSCOLOR:

```bash
python tools/extract_dbf.py
```

Переменная `GDATA` в начале скрипта указывает на `C:\G_SPIVER` — поменяйте при необходимости.

## Исходные файлы БД

```
C:\G_SPIVER\
  FVERS.DAT               версия пакета (1.30 SPIVER 261011)
  PARAM.DBF               параметры системы (DATAID, кодовая страница, ...)
  PRODUCTS.DBF            14 линий краски
  PROD000N\SUBPRODS.DBF   продукты линии
  BASES.DBF               базы (scoped: PROD_KEY + SUBP_KEY)
  CANS.DBF                размеры банок
  CNTS.DBF                16 колорантов
  COLORKEY.DBF            3130 кодов цветов (KEY1/KEY2/KEY3)
  <prod>\<subprod>\FRM.DBF      формулы
  <prod>\<subprod>\FRM_REFL.DBF спектры отражения R_400…R_700 (обычно −1 в 1.30)
  <prod>\<subprod>\MASK.DBF, RULER.DBF, CYLINDER.DBF   служебные
```

Поле `FRM.FORMULA` — строка вида `"cid,amount,cid,amount,..."` где `cid` — `CNTS.ID`, `amount` — количество единиц-долей (1 ед = `PRODUCTS.UNIT / PRODUCTS.FRACTION` = 31.240 / 96 ≈ 0.3254 мл).

## Источники

- `D:\FTP\prg\CPSCOLOR 4.12\Manuals\English\DB-LINK.pdf` — официальная спецификация COROB по структуре таблиц.
- `The concept of Catalog and GDATAID - English.pdf` — архитектура каталога GDATA.
- `ColorLAB Light Manual - English.pdf` — описание приложения, создающего GDATA.

## Лицензия

Исходный код — MIT. База данных Spiver является собственностью Spiver S.p.A. / COROB s.r.l. — используется только для локального расчёта (не перераспространяется отдельно; повторный экспорт требует лицензии CPSCOLOR).
