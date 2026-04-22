"""Extract SPIVER COROB database (C:\\G_SPIVER) into data.js + per-product formula files.

dBase III (.dbf) structure in C:\\G_SPIVER (CPSCOLOR 4.12 family, SPIVER 26-10-2011):
  PRODUCTS.DBF        14 product lines (REOSAN, INT, EXTINT, SILICATI, SILOSSANI, ...)
  PROD000N/SUBPRODS.DBF   paint sub-lines
  BASES.DBF           bases (P, M, ST, T, GRIGIA, ...)
  CANS.DBF            can sizes (0.375/0.5/0.75/1/2.5/5/10/15 LT, 1/5 KG)
  CNTS.DBF            16 colorants (AXX, B, C, D, E, F, G, I, L, M, N, R, S, U, V, W)
  COLORKEY.DBF        3130 cross-referenced color codes
  <prod>/<subprod>/FRM.DBF  actual formulas (KEY1..KEY3, BASE_ID, CAN_ID, FORMULA, R/G/B + CIE XYZ)

FRM.FORMULA = "cid,amount,cid,amount,..." in drop-subdivision units.
drop_ml = PRODUCTS.UNIT / PRODUCTS.FRACTION = 31.240 / 96 = 0.3254 ml (CPSCOLOR 1/96 EU fl.oz.).
Each formula is for a specific CAN_ID; scale by target_volume / can.NOM_Q.

Output:
  data.js              core tables + product catalog
  formulas/p<N>.js     per-product flat-array formulas
"""

import json
import os
import struct

GDATA = r"C:\G_SPIVER"
ENCODING = "cp850"
OUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def read_dbf(path):
    with open(path, "rb") as f:
        data = f.read()
    records = struct.unpack("<I", data[4:8])[0]
    header_size = struct.unpack("<H", data[8:10])[0]
    record_size = struct.unpack("<H", data[10:12])[0]
    fields = []
    pos = 32
    while data[pos] != 0x0D:
        name = data[pos : pos + 11].rstrip(b"\x00").decode("ascii")
        ftype = chr(data[pos + 11])
        flen = data[pos + 16]
        fields.append((name, ftype, flen))
        pos += 32
    out = []
    pos = header_size
    for _ in range(records):
        if data[pos] == 0x2A:
            pos += record_size
            continue
        rec, p = {}, pos + 1
        for name, _t, flen in fields:
            raw = data[p : p + flen]
            try:
                rec[name] = raw.decode(ENCODING).strip()
            except UnicodeDecodeError:
                rec[name] = raw.hex()
            p += flen
        out.append(rec)
        pos += record_size
    return out


def num(v, default=0.0):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def rgb_int(r):
    raw = [r.get("R_MON", ""), r.get("G_MON", ""), r.get("B_MON", "")]
    if all(s != "" for s in raw):
        rr, gg, bb = (int(num(s, -1)) for s in raw)
        if rr >= 0 and gg >= 0 and bb >= 0:
            return [rr & 0xFF, gg & 0xFF, bb & 0xFF]
    # Fall back to CIE XYZ (D65 2°) → sRGB. SPIVER stores X,Y,Z on 0-100 scale.
    x, y, z = num(r.get("X_02", 0)), num(r.get("Y_02", 0)), num(r.get("Z_02", 0))
    if x <= 0 or y <= 0 or z <= 0:
        return None
    xr, yr, zr = x / 100, y / 100, z / 100
    lr = 3.2406 * xr - 1.5372 * yr - 0.4986 * zr
    lg = -0.9689 * xr + 1.8758 * yr + 0.0415 * zr
    lb = 0.0557 * xr - 0.2040 * yr + 1.0570 * zr

    def gamma(c):
        c = max(0.0, min(1.0, c))
        c = 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055
        return round(max(0.0, min(1.0, c)) * 255)

    return [gamma(lr), gamma(lg), gamma(lb)]


def compact_formula(f):
    parts = f.split(",")
    pairs = []
    for i in range(0, len(parts) - 1, 2):
        cid = parts[i].strip()
        amt = parts[i + 1].strip()
        if not cid or not amt:
            continue
        try:
            a = float(amt)
        except ValueError:
            continue
        if a <= 0:
            continue
        a_str = str(int(a)) if a.is_integer() else str(a)
        pairs.append(f"{cid}:{a_str}")
    return ";".join(pairs)


def write_js(path, var_assign, obj):
    with open(path, "w", encoding="utf-8") as f:
        f.write("// Auto-generated from C:\\G_SPIVER by tools/extract_dbf.py. Do not edit.\n")
        f.write(f"{var_assign} = ")
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")


def read_version():
    path = os.path.join(GDATA, "FVERS.DAT")
    if not os.path.exists(path):
        return "SPIVER"
    with open(path, "rb") as f:
        return f.read().decode("ascii", errors="replace").strip()


def main():
    products = read_dbf(os.path.join(GDATA, "PRODUCTS.DBF"))
    cans = {r["ID"]: r for r in read_dbf(os.path.join(GDATA, "CANS.DBF"))}
    raw_bases = read_dbf(os.path.join(GDATA, "BASES.DBF"))
    cnts = {r["ID"]: r for r in read_dbf(os.path.join(GDATA, "CNTS.DBF"))}

    drop_ml = num(products[0]["UNIT"]) / num(products[0]["FRACTION"])

    out_colorants = [
        {
            "id": cid,
            "code": c["CODE"],
            "descr": c["DESCR"],
            "hex": "#%02x%02x%02x" % (int(num(c["R_MON"])) & 0xFF, int(num(c["G_MON"])) & 0xFF, int(num(c["B_MON"])) & 0xFF),
            "density": (num(c["SPEC_W"]) / 1000) or None,
        }
        for cid, c in sorted(cnts.items(), key=lambda x: int(x[0]))
    ]

    # bases are scoped by (PROD_KEY, SUBP_KEY); key as "prd:sp:id" with "" for global
    out_bases = {}
    for b in raw_bases:
        key = f"{b.get('PROD_KEY','')}:{b.get('SUBP_KEY','')}:{b['ID']}"
        out_bases[key] = {
            "code": b["CODE"],
            "descr": b["DESCR"],
            "density": (num(b["SPEC_W"]) / 1000) or None,
        }

    out_cans = {
        cid: {
            "descr": c["DESCR"],
            "amount": num(c["NOM_Q"]),
            "kind": "mass" if "KG" in c["DESCR"].upper() else "volume",
        }
        for cid, c in cans.items()
    }

    product_catalog = []
    os.makedirs(os.path.join(OUT_DIR, "formulas"), exist_ok=True)

    total_formulas = 0
    for prd in products:
        prd_id = prd["ID"]
        sp_path = os.path.join(GDATA, prd["PATH"], "SUBPRODS.DBF")
        subprods = read_dbf(sp_path) if os.path.exists(sp_path) else []

        catalog_sps = []
        product_formulas = []
        for sp in subprods:
            frm_path = os.path.join(GDATA, prd["PATH"], sp["PATH"], "FRM.DBF")
            if not os.path.exists(frm_path):
                continue
            sp_formula_count = 0
            for r in read_dbf(frm_path):
                cf = compact_formula(r["FORMULA"])
                if not cf:
                    continue
                rgb = rgb_int(r)
                product_formulas.append(
                    [
                        sp["ID"],
                        r["KEY1"],
                        r.get("KEY2", ""),
                        r.get("KEY3", ""),
                        r["BASE_ID"],
                        r["CAN_ID"],
                        cf,
                        rgb,
                    ]
                )
                sp_formula_count += 1
            if sp_formula_count > 0:
                catalog_sps.append(
                    {"id": sp["ID"], "code": sp["CODE"], "descr": sp["DESCR"], "n": sp_formula_count}
                )

        if catalog_sps:
            product_catalog.append(
                {"id": prd_id, "code": prd["CODE"], "descr": prd["DESCR"], "subproducts": catalog_sps}
            )
            out_path = os.path.join(OUT_DIR, "formulas", f"p{prd_id}.js")
            write_js(out_path, f"window.SPIVER_FORMULAS_P{prd_id}", product_formulas)
            print(f"  p{prd_id}.js ({prd['CODE']:<12}): {len(product_formulas):>6,} formulas, {os.path.getsize(out_path):>10,} bytes")
            total_formulas += len(product_formulas)

    core = {
        "version": read_version(),
        "drop_ml": drop_ml,
        "colorants": out_colorants,
        "bases": out_bases,
        "cans": out_cans,
        "products": product_catalog,
    }
    core_path = os.path.join(OUT_DIR, "data.js")
    write_js(core_path, "window.SPIVER_DATA", core)
    print(f"data.js: {os.path.getsize(core_path):,} bytes")
    print(f"Total formulas: {total_formulas:,}")


if __name__ == "__main__":
    main()
