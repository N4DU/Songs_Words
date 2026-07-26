"""Regenerate static/js/i18n.js from translations.csv.

The CSV is the single source of truth for every interface text:
  - one row per text key, one column per language;
  - the special row `_langName` holds each language's own name;
  - edit it with Excel/LibreOffice (or straight on GitHub), then run:

        python tools/build_i18n.py

Never edit static/js/i18n.js by hand: it is overwritten by this script.
"""

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "translations.csv"
JS_PATH = ROOT / "static" / "js" / "i18n.js"

HEADER = """\
// GENERATED FILE — do not edit by hand.
// Source of truth: translations.csv (repo root). One row per text, one
// column per language; edit it with any spreadsheet and regenerate with:
//     python tools/build_i18n.py
"""

RUNTIME = """
let lang = 'en';

export function setLang(code) {
  if (STRINGS[code]) lang = code;
}

export function getLang() {
  return lang;
}

// t('progress', { n: 1, total: 3 }) fills the {n}/{total} placeholders.
export function t(key, vars) {
  let s = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key;
  if (vars) for (const k of Object.keys(vars)) s = s.replaceAll(`{${k}}`, vars[k]);
  return s;
}
"""


def main():
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        rows = list(csv.reader(f))

    header, data = rows[0], rows[1:]
    if header[0] != "key":
        raise SystemExit("translations.csv: first column must be 'key'")
    codes = header[1:]

    names = None
    table = {}  # key -> [text per language]
    for row in data:
        if not row or not row[0].strip():
            continue
        key, texts = row[0].strip(), row[1:]
        if len(texts) != len(codes):
            raise SystemExit(f"translations.csv: row '{key}' has {len(texts)} "
                             f"columns, expected {len(codes)}")
        empty = [codes[i] for i, s in enumerate(texts) if not s.strip()]
        if empty:
            raise SystemExit(f"translations.csv: row '{key}' is empty for: "
                             f"{', '.join(empty)}")
        if key == "_langName":
            names = texts
        else:
            table[key] = texts

    if names is None:
        raise SystemExit("translations.csv: missing the '_langName' row")

    js = json.dumps  # valid JSON strings are valid JS strings
    out = [HEADER]
    out.append("export const LANGS = [")
    for code, name in zip(codes, names):
        out.append(f"  [{js(code)}, {js(name, ensure_ascii=False)}],")
    out.append("];")
    out.append(RUNTIME)
    out.append("export const STRINGS = {")
    for i, code in enumerate(codes):
        out.append(f"  {code}: {{")
        for key, texts in table.items():
            out.append(f"    {key}: {js(texts[i], ensure_ascii=False)},")
        out.append("  },")
    out.append("};")

    JS_PATH.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"i18n.js regenerated: {len(codes)} languages, {len(table)} texts.")


if __name__ == "__main__":
    main()
