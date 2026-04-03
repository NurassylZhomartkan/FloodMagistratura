import io
import json
import os
import re
import sys
import time
from datetime import date
from datetime import datetime
import uuid

import pandas as pd
import requests
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait
from database.hydro_allowed_stations import ALLOWED_HYDRO_STATION_IDS
from database.database import SessionLocal
from database.hydro_station_io import upsert_hydro_from_scrape

if hasattr(sys.stdout, "buffer"):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "buffer"):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

BASE_URL = "http://ecodata.kz:3838/app_dg_map_kz/"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
CHROME_BIN = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

DATE_START = os.environ.get("HYDRO_TS_DATE_START", "2020-01-01")
DATE_END = os.environ.get("HYDRO_TS_DATE_END", date.today().isoformat())

WAIT_INIT = int(os.environ.get("HYDRO_TS_WAIT_INIT", "25"))
WAIT_STATION = int(os.environ.get("HYDRO_TS_WAIT_STATION", "5"))
TARGET_STATION_IDS: list[str] = sorted(ALLOWED_HYDRO_STATION_IDS, key=int)

os.makedirs(OUTPUT_DIR, exist_ok=True)


def _norm_station_id(x) -> str:
    if pd.isna(x):
        return ""
    try:
        return str(int(float(x)))
    except (ValueError, TypeError):
        return str(x).strip()


def filter_stations_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    if df.empty or "station_id" not in df.columns:
        return df
    want = set(TARGET_STATION_IDS)
    mask = df["station_id"].map(_norm_station_id).isin(want)
    return df.loc[mask].copy()


def fix_encoding(text: str | None) -> str:
    if not text:
        return text or ""
    try:
        return text.encode("latin-1").decode("utf-8")
    except (UnicodeDecodeError, UnicodeEncodeError):
        return text


def parse_sockjs(payload: str) -> dict | None:
    if not payload or not payload.startswith("a["):
        return None
    try:
        inner_list = json.loads(payload[1:])
        if not inner_list or not isinstance(inner_list, list):
            return None
        msg_str = inner_list[0]
        idx = msg_str.find("|m|")
        if idx == -1:
            return None
        return json.loads(msg_str[idx + 3:])
    except Exception:
        return None


def parse_popup(html: str | None) -> dict:
    if not html:
        return {}
    try:
        soup = BeautifulSoup(fix_encoding(html), "lxml")
        caption = soup.find("caption")
        station_name, date_str = "", ""
        if caption:
            cap_text = caption.get_text(" ", strip=True)
            dm = re.search(r"\d{4}-\d{2}-\d{2}", cap_text)
            if dm:
                date_str = dm.group()
                station_name = cap_text[:dm.start()].strip(" <tr>")
            else:
                station_name = cap_text.strip()
        result = {"station_name": station_name, "date": date_str}
        for row in soup.find_all("tr"):
            cells = row.find_all(["td", "th"])
            if len(cells) >= 2:
                k = cells[0].get_text(strip=True)
                v = cells[1].get_text(strip=True)
                if k and "tableHTML" not in k:
                    result[k] = v
        return result
    except Exception as e:
        return {"parse_error": str(e)}


def extract_markers(args: list) -> list[dict]:
    if len(args) < 2:
        return []
    lats = args[0] if isinstance(args[0], list) else [args[0]]
    lons = args[1] if isinstance(args[1], list) else [args[1]]
    n = len(lats)
    ids = args[3] if len(args) > 3 and isinstance(args[3], list) else [None] * n
    popups = args[6] if len(args) > 6 and isinstance(args[6], list) else [None] * n
    labels = args[10] if len(args) > 10 and isinstance(args[10], list) else [None] * n
    colors = [None] * n
    if len(args) > 2 and isinstance(args[2], dict):
        mc = args[2].get("markerColor", [None] * n)
        colors = mc if isinstance(mc, list) else [mc] * n
    rows = []
    for i in range(n):
        popup_data = parse_popup(popups[i] if i < len(popups) else None)
        if not popup_data.get("station_name") and i < len(labels) and labels[i]:
            popup_data["station_name"] = fix_encoding(labels[i])
        rows.append(
            {
                "lat": lats[i],
                "lon": lons[i],
                "station_id": ids[i] if i < len(ids) else None,
                "color": colors[i] if i < len(colors) else None,
                **popup_data,
            }
        )
    return rows


def parse_map(messages: list[dict]) -> list[dict]:
    last_map = None
    for msg in messages:
        mo = msg.get("values", {}).get("map")
        if not mo:
            continue
        calls = mo.get("x", {}).get("calls", [])
        if any(c["method"] in ("addAwesomeMarkers", "addMarkers", "addCircleMarkers") for c in calls):
            last_map = mo
    if not last_map:
        return []
    rows = []
    for call in last_map.get("x", {}).get("calls", []):
        if call["method"] in ("addAwesomeMarkers", "addMarkers", "addCircleMarkers"):
            rows.extend(extract_markers(call["args"]))
    return rows


def make_driver() -> webdriver.Chrome:
    opts = Options()
    if CHROME_BIN and os.path.isfile(CHROME_BIN):
        opts.binary_location = CHROME_BIN
    opts.add_argument("--headless=new")
    opts.add_argument("--no-sandbox")
    opts.add_argument("--disable-dev-shm-usage")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--window-size=1920,1080")
    opts.set_capability("goog:loggingPrefs", {"performance": "ALL"})
    return webdriver.Chrome(options=opts)


def read_perf_messages(driver: webdriver.Chrome) -> list[dict]:
    logs = driver.get_log("performance")
    msgs = []
    for entry in logs:
        try:
            lm = json.loads(entry["message"])
            if lm.get("message", {}).get("method") != "Network.webSocketFrameReceived":
                continue
            payload = lm["message"]["params"]["response"]["payloadData"]
            parsed = parse_sockjs(payload)
            if parsed:
                msgs.append(parsed)
        except Exception:
            pass
    return msgs


def get_session_cookies(driver: webdriver.Chrome) -> dict:
    return {c["name"]: c["value"] for c in driver.get_cookies()}


def scrape_stations() -> pd.DataFrame:
    print("\n" + "=" * 58)
    print("  ЭТАП 1: Сбор данных станций (текущие значения)")
    print("=" * 58)

    all_rows = []

    for param in ("level", "discharge"):
        print(f"\n  >> Параметр: {param}")
        driver = make_driver()
        try:
            driver.get(BASE_URL)
            print(f"     Загрузка {WAIT_INIT}с...")
            time.sleep(WAIT_INIT)

            if param != "level":
                try:
                    el = WebDriverWait(driver, 15).until(EC.presence_of_element_located((By.ID, "value")))
                    Select(el).select_by_value(param)
                    time.sleep(12)
                except Exception as e:
                    print(f"     Ошибка выбора параметра: {e}")

            messages = read_perf_messages(driver)
            rows = parse_map(messages)
            for r in rows:
                r["param"] = param
            all_rows.extend(rows)
            print(f"     Станций: {len(rows)}")
        finally:
            driver.quit()

    if not all_rows:
        print("  [!] Данные не получены")
        return pd.DataFrame()

    df = pd.DataFrame(all_rows)
    print(f"  Станции в памяти: {len(df)} строк")
    return df


def parse_excel_timeseries(content: bytes, station_id, station_name: str) -> pd.DataFrame:
    try:
        df_raw = pd.read_excel(io.BytesIO(content), sheet_name=0, header=None)
        header_row = None
        for i, row in df_raw.iterrows():
            vals = [str(v).strip().lower() for v in row if pd.notna(v)]
            if "river_name" in vals and "post_name" in vals and "date" in vals and "time" in vals and "level" in vals:
                header_row = i
                break
        if header_row is None:
            return pd.DataFrame()

        df = pd.read_excel(io.BytesIO(content), sheet_name=0, header=header_row)
        df = df.dropna(how="all")
        df.insert(0, "station_id", station_id)
        df.insert(1, "station_name", station_name)
        return df
    except Exception as e:
        print(f"     Excel parse error: {e}")
        return pd.DataFrame()


def _save_progress(done_ids: set):
    print(f"\n  [Progress] обработано станций: {len(done_ids)}")


def _as_str_or_none(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    s = str(value).strip()
    return s if s else None


def save_timeseries_to_db(timeseries_df: pd.DataFrame, stations_df: pd.DataFrame) -> int:
    if timeseries_df.empty:
        return 0
    timeseries_df = timeseries_df[timeseries_df["station_id"].map(_norm_station_id).isin(set(TARGET_STATION_IDS))].copy()
    if timeseries_df.empty:
        return 0

    station_meta = (
        stations_df[stations_df["param"] == "level"][["station_id", "station_name", "lat", "lon"]]
        .drop_duplicates("station_id")
        .copy()
    )
    station_meta["station_id_norm"] = station_meta["station_id"].map(_norm_station_id)
    by_station = {row["station_id_norm"]: row for _, row in station_meta.iterrows()}

    rows_for_upsert: list[dict] = []
    for _, r in timeseries_df.iterrows():
        sid = _norm_station_id(r.get("station_id"))
        if not sid:
            continue
        meta = by_station.get(sid, {})
        station_name = _as_str_or_none(r.get("station_name")) or _as_str_or_none(meta.get("station_name"))
        row_date = _as_str_or_none(r.get("date"))
        if not row_date:
            continue

        common = {
            "station_id": sid,
            "station_name": station_name,
            "lat": meta.get("lat"),
            "lon": meta.get("lon"),
            "date": row_date,
            "color": None,
            "time": _as_str_or_none(r.get("time")),
            "river_name": _as_str_or_none(r.get("river_name")),
            "post_name": _as_str_or_none(r.get("post_name")),
        }

        level_row = dict(common)
        level_row["param"] = "level"
        level_row["actual_level"] = _as_str_or_none(r.get("level"))
        level_row["danger_level"] = None
        level_row["water_temp"] = _as_str_or_none(r.get("temp"))
        level_row["status_code"] = _as_str_or_none(r.get("status1")) or _as_str_or_none(r.get("status2"))
        rows_for_upsert.append(level_row)

        discharge_row = dict(common)
        discharge_row["param"] = "discharge"
        discharge_row["discharge"] = _as_str_or_none(r.get("discharge"))
        discharge_row["water_temp"] = _as_str_or_none(r.get("temp"))
        discharge_row["status_code"] = _as_str_or_none(r.get("status1")) or _as_str_or_none(r.get("status2"))
        rows_for_upsert.append(discharge_row)

    if not rows_for_upsert:
        return 0

    db = SessionLocal()
    try:
        batch_id = str(uuid.uuid4())
        n = upsert_hydro_from_scrape(db, rows_for_upsert, batch_id, datetime.utcnow())
        return n
    finally:
        db.close()


def download_timeseries(stations_df: pd.DataFrame, date_start: str = DATE_START, date_end: str = DATE_END) -> pd.DataFrame:
    print("\n" + "=" * 58)
    print(f"  ЭТАП 2: Временные ряды ({date_start} -> {date_end})")
    print("=" * 58)

    if "station_id" not in stations_df.columns:
        print("  [!] Нет данных станций — сначала запустите scrape_stations()")
        return pd.DataFrame()

    uniq = (
        stations_df[stations_df["param"] == "level"][["station_id", "lat", "lon", "station_name"]]
        .drop_duplicates("station_id")
        .reset_index(drop=True)
    )

    want = set(TARGET_STATION_IDS)
    uniq["_sid"] = uniq["station_id"].map(_norm_station_id)
    uniq = uniq[uniq["_sid"].isin(want)].copy()
    order_map = {_norm_station_id(i): j for j, i in enumerate(TARGET_STATION_IDS)}
    uniq["_ord"] = uniq["_sid"].map(lambda s: order_map.get(s, 9999))
    uniq = uniq.sort_values("_ord").drop(columns=["_sid", "_ord"]).reset_index(drop=True)
    missing = want - set(uniq["station_id"].map(_norm_station_id))
    if missing:
        print(f"  [!] На сайте не найдены ID из списка 25: {sorted(missing, key=int)}")

    total = len(uniq)
    print(f"  Станций для скачивания: {total}")
    print("  (режим: строго только 25 гидропостов из ALLOWED_HYDRO_STATION_IDS)")
    print(f"  Примерное время: ~{max(1, total * WAIT_STATION // 60)} мин\n")

    if total == 0:
        print("  [!] Нет станций для скачивания")
        return pd.DataFrame()

    driver = make_driver()
    all_dfs = []
    errors = []
    done_ids: set[str] = set()

    try:
        driver.get(BASE_URL)
        print(f"  Загрузка страницы ({WAIT_INIT}с)...")
        time.sleep(WAIT_INIT)

        driver.execute_script(
            f"""
            Shiny.setInputValue('daterange', ['{date_start}', '{date_end}'], {{priority: 'event'}});
            """
        )
        time.sleep(3)

        for idx, row in uniq.iterrows():
            sid = _norm_station_id(row["station_id"])
            lat = float(row["lat"])
            lon = float(row["lon"])
            name = str(row["station_name"])

            if sid in done_ids:
                continue

            disp = name[:45]
            print(f"  [{idx + 1:3d}/{total}] ID={sid:6s}  {disp}", end="... ", flush=True)

            try:
                driver.execute_script(
                    f"""
                    Shiny.setInputValue('map_marker_click', {{
                        id: '{sid}',
                        lat: {lat},
                        lng: {lon},
                        '.nonce': Math.random()
                    }}, {{priority: 'event'}});
                    """
                )
                time.sleep(WAIT_STATION)

                btn = driver.find_element(By.ID, "downloadData")
                driver.execute_script("arguments[0].removeAttribute('disabled');", btn)
                href = btn.get_attribute("href")

                if not href or len(href) < 10:
                    print("no href")
                    errors.append(sid)
                    continue

                r = requests.get(href, cookies=get_session_cookies(driver), timeout=30)

                if r.status_code == 200 and len(r.content) > 500:
                    df_ts = parse_excel_timeseries(r.content, sid, name)
                    if not df_ts.empty:
                        all_dfs.append(df_ts)
                        done_ids.add(sid)
                        print(f"OK ({len(df_ts)} rows)")
                    else:
                        print("empty Excel")
                        errors.append(sid)
                else:
                    print(f"HTTP {r.status_code}")
                    errors.append(sid)

                step = 5 if total <= 40 else 20
                if (idx + 1) % step == 0:
                    _save_progress(done_ids)

            except Exception as e:
                print(f"ERROR: {e}")
                errors.append(sid)
                try:
                    driver.get(BASE_URL)
                    time.sleep(WAIT_INIT)
                    driver.execute_script(
                        f"""
                        Shiny.setInputValue('daterange', ['{date_start}', '{date_end}'], {{priority: 'event'}});
                        """
                    )
                    time.sleep(3)
                except Exception:
                    pass
    finally:
        driver.quit()

    if all_dfs:
        combined = pd.concat(all_dfs, ignore_index=True)
        print(f"\n  Временные ряды собраны в память: {len(combined):,} строк")
        if errors:
            print(f"  [!] Ошибки при {len(errors)} станциях: {errors[:10]}{'...' if len(errors) > 10 else ''}")
        return combined

    print("  [!] Данные временных рядов не получены")
    return pd.DataFrame()


def main():
    print("=" * 58)
    print("  Гидрологический мониторинг Казахстана — Парсер")
    print(f"  {BASE_URL}")
    print("=" * 58)

    stations_df = scrape_stations()

    if stations_df.empty:
        print("  Ошибка: нет данных станций")
        return

    sel = filter_stations_dataframe(stations_df)
    n_posts = sel["station_id"].map(_norm_station_id).nunique() if "station_id" in sel.columns else 0
    print(f"\n  Белый список (25): найдено на карте {n_posts} постов, {len(sel)} строк")
    work_df = sel

    ts_df = download_timeseries(work_df, DATE_START, DATE_END)
    saved = save_timeseries_to_db(ts_df, stations_df)

    print("\n" + "=" * 58)
    print(f"  Сохранено в БД (UPSERT): {saved} записей")
    print("=" * 58)

    if not ts_df.empty:
        print("\n  Предпросмотр временного ряда (5 строк):")
        pd.set_option("display.max_columns", 12)
        pd.set_option("display.width", 140)
        print(ts_df.head(5).to_string(index=False))


if __name__ == "__main__":
    main()
