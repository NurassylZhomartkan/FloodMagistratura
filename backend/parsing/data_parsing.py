"""
Парсер сайта гидрологического мониторинга Казахстана
http://ecodata.kz:3838/app_dg_map_kz/

Метод: Selenium (Chrome headless) + Chrome Performance Logs (CDP).
Перехватывает WebSocket-фреймы SockJS и извлекает данные:
  - 442 гидрологических станции: координаты, ID, название
  - Опасный уровень, фактический уровень, расход воды, температура, код состояния
  - Параметры: level (уровень) и discharge (расход)

Сохранение в БД (см. database.hydro_station_io): дата наблюдения из popup;
в таблицы попадают только записи с датой >= 2020-01-01. Полная история с 2020 года
накапливается при регулярных прогонах (каждый день на карте — своя дата).
"""

import io
import json
import os
import re
import sys
import time
from datetime import date

# Selenium Manager по умолчанию шлёт статистику на plausible.io; при блокировке сети — WARNING в логах
os.environ.setdefault("SE_AVOID_STATS", "true")

import pandas as pd
from bs4 import BeautifulSoup

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait

# ── Настройки ──────────────────────────────────────────────
BASE_URL   = "http://ecodata.kz:3838/app_dg_map_kz/"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
_DEFAULT_CHROME = (
    r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    if sys.platform == "win32"
    else "/usr/bin/google-chrome"
)
CHROME_BIN = os.environ.get("CHROME_BIN", _DEFAULT_CHROME)
WAIT_SECS  = int(os.environ.get("HYDRO_SCRAPE_WAIT_SECS", "25"))  # ожидание загрузки Shiny

os.makedirs(OUTPUT_DIR, exist_ok=True)


# ─────────────────────────────────────────────────────────────
# Утилиты
# ─────────────────────────────────────────────────────────────

def fix_encoding(text: str | None) -> str:
    """
    Chrome CDP возвращает UTF-8 данные через Latin-1 буфер —
    применяем encode('latin-1').decode('utf-8').
    """
    if not text:
        return text or ""
    try:
        return text.encode("latin-1").decode("utf-8")
    except (UnicodeDecodeError, UnicodeEncodeError):
        return text


def parse_popup_table(html: str | None) -> dict:
    """
    Разбирает HTML popup-таблицу одной станции.
    Возвращает словарь: station_name, date, и поля таблицы.
    """
    if not html:
        return {}
    try:
        html_fixed = fix_encoding(html)
        soup = BeautifulSoup(html_fixed, "lxml")

        caption = soup.find("caption")
        station_name, date_str = "", ""
        if caption:
            cap_text = caption.get_text(" ", strip=True)
            date_m = re.search(r"\d{4}-\d{2}-\d{2}", cap_text)
            if date_m:
                date_str = date_m.group()
                station_name = cap_text[:date_m.start()].strip(" <tr>")
            else:
                station_name = cap_text.strip()

        result = {"station_name": station_name, "date": date_str}

        for row in soup.find_all("tr"):
            cells = row.find_all(["td", "th"])
            if len(cells) >= 2:
                key = cells[0].get_text(strip=True)
                val = cells[1].get_text(strip=True)
                if key and "tableHTML" not in key:
                    result[key] = val

        return result
    except Exception as e:
        return {"parse_error": str(e)}


# ─────────────────────────────────────────────────────────────
# Разбор SockJS / Shiny-сообщений из CDP
# ─────────────────────────────────────────────────────────────

def parse_sockjs(payload: str) -> dict | None:
    """
    Извлекает JSON из SockJS-фрейма формата a["N#0|m|{JSON}"].
    Chrome CDP хранит строки с двойным экранированием, поэтому
    сначала парсим внешний JSON-массив (снимаем экранирование),
    потом парсим внутренний JSON.
    """
    if not payload or not payload.startswith("a["):
        return None
    try:
        # Убираем ведущий 'a', парсим как JSON-массив ["N#0|m|{JSON}", ...]
        inner_list = json.loads(payload[1:])
        if not inner_list or not isinstance(inner_list, list):
            return None
        msg_str = inner_list[0]           # "N#0|m|{"key":"val",...}"
        idx = msg_str.find("|m|")
        if idx == -1:
            return None
        return json.loads(msg_str[idx + 3:])
    except Exception:
        return None


def read_perf_logs(driver: webdriver.Chrome) -> list[dict]:
    """Читает CDP performance logs и возвращает Shiny WS-сообщения."""
    logs = driver.get_log("performance")
    print(f"     CDP logs: {len(logs)} entries")
    messages = []
    for entry in logs:
        try:
            log_msg = json.loads(entry["message"])
            method  = log_msg.get("message", {}).get("method", "")
            if method != "Network.webSocketFrameReceived":
                continue
            payload = log_msg["message"]["params"]["response"]["payloadData"]
            parsed  = parse_sockjs(payload)
            if parsed:
                messages.append(parsed)
        except Exception:
            pass
    return messages


# ─────────────────────────────────────────────────────────────
# Разбор данных карты
# ─────────────────────────────────────────────────────────────

def extract_markers(args: list) -> list[dict]:
    """Извлекает строки маркеров из аргументов addAwesomeMarkers."""
    if len(args) < 2:
        return []
    lats = args[0] if isinstance(args[0], list) else [args[0]]
    lons = args[1] if isinstance(args[1], list) else [args[1]]
    n    = len(lats)

    station_ids = args[3] if len(args) > 3 and isinstance(args[3], list) else [None] * n
    popups      = args[6] if len(args) > 6 and isinstance(args[6], list) else [None] * n
    labels      = args[10] if len(args) > 10 and isinstance(args[10], list) else [None] * n

    colors = [None] * n
    if len(args) > 2 and isinstance(args[2], dict):
        mc = args[2].get("markerColor", [None] * n)
        colors = mc if isinstance(mc, list) else [mc] * n

    rows = []
    for i in range(n):
        popup_data = parse_popup_table(popups[i] if i < len(popups) else None)
        if not popup_data.get("station_name") and i < len(labels) and labels[i]:
            popup_data["station_name"] = fix_encoding(labels[i])

        rows.append({
            "lat":        lats[i],
            "lon":        lons[i],
            "station_id": station_ids[i] if i < len(station_ids) else None,
            "color":      colors[i] if i < len(colors) else None,
            **popup_data,
        })
    return rows


def parse_map(messages: list[dict]) -> list[dict]:
    """
    Извлекает маркеры из Shiny WS-сообщений.
    Используем только ПОСЛЕДНЕЕ сообщение с данными карты —
    оно соответствует актуальному выбранному параметру.
    """
    # Находим последнее сообщение с полными данными карты (с вызовами addMarkers)
    last_map_obj = None
    for msg in messages:
        map_obj = msg.get("values", {}).get("map")
        if not map_obj:
            continue
        calls = map_obj.get("x", {}).get("calls", [])
        has_markers = any(c["method"] in ("addAwesomeMarkers", "addMarkers", "addCircleMarkers")
                          for c in calls)
        if has_markers:
            last_map_obj = map_obj

    if not last_map_obj:
        return []

    rows = []
    for call in last_map_obj.get("x", {}).get("calls", []):
        if call["method"] in ("addAwesomeMarkers", "addMarkers", "addCircleMarkers"):
            rows.extend(extract_markers(call["args"]))
    return rows


# ─────────────────────────────────────────────────────────────
# Selenium
# ─────────────────────────────────────────────────────────────

def make_driver() -> webdriver.Chrome:
    """Создаёт Chrome-драйвер с performance logging."""
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


def _try_set_observed_on(driver: webdriver.Chrome, observed_on: str) -> bool:
    """
    Пытается установить дату на странице (формат YYYY-MM-DD).
    Возвращает True, если удалось найти поле даты.
    """
    js = """
    const target = arguments[0];
    const selectors = [
      '#date', '#date_on', '#dateInput', '#date-input', '#obs_date', '#observed_on',
      'input[type="date"]', 'input[name="date"]', 'input[name="date_on"]',
      'input[name="observed_on"]', 'input[id*="date"]', 'input[name*="date"]'
    ];
    let input = null;
    for (const sel of selectors) {
      const found = document.querySelector(sel);
      if (found) { input = found; break; }
    }
    if (!input) return false;
    input.focus();
    input.value = target;
    input.setAttribute('value', target);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
    return true;
    """
    try:
        ok = bool(driver.execute_script(js, observed_on))
    except Exception:
        return False
    if not ok:
        return False

    # Пробуем инициировать обновление карты.
    for sel in ("#refresh", "#apply", "#show", "#submit", "button[type='submit']"):
        try:
            btn = driver.find_element(By.CSS_SELECTOR, sel)
            if btn.is_displayed() and btn.is_enabled():
                btn.click()
                break
        except Exception:
            pass
    return True


def scrape(
    param: str,
    *,
    save_excel: bool = False,
    allowed_station_ids: frozenset[str] | None = None,
    observed_on: str | date | None = None,
) -> tuple[list[dict], list[dict]]:
    """
    Возвращает (маркеры, все Shiny-сообщения) для заданного параметра.
    По умолчанию ничего не пишет на диск — только данные в памяти для сохранения в БД.
    save_excel=True — устаревший режим для ручного CLI (hydro_data.xlsx).
    allowed_station_ids — если задано, в результате только эти station_id (нормализация как у БД).
    """
    print(f"\n  >> Параметр: {param}")
    driver = make_driver()
    rows, messages = [], []

    try:
        driver.get(BASE_URL)
        print(f"     Ожидание загрузки {WAIT_SECS}с...")
        time.sleep(WAIT_SECS)

        # Выбираем параметр (если не level)
        if param != "level":
            try:
                sel_el = WebDriverWait(driver, 15).until(
                    EC.presence_of_element_located((By.ID, "value"))
                )
                Select(sel_el).select_by_value(param)
                print(f"     Параметр '{param}' выбран, ожидание 15с...")
                time.sleep(15)
            except Exception as e:
                print(f"     Не удалось выбрать параметр: {e}")

        if observed_on is not None:
            d = observed_on.isoformat() if hasattr(observed_on, "isoformat") else str(observed_on)
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}", d):
                applied = _try_set_observed_on(driver, d)
                if applied:
                    print(f"     Дата '{d}' применена, ожидание 8с...")
                    time.sleep(8)
                else:
                    print("     Поле даты не найдено, используем дату по умолчанию сайта.")

        # Читаем CDP-логи
        messages = read_perf_logs(driver)
        print(f"     Shiny-сообщений: {len(messages)}")

        rows = parse_map(messages)
        if allowed_station_ids is not None:
            def _sid(v):
                if v is None or v == "":
                    return ""
                s = str(v).strip()
                try:
                    return str(int(float(s.replace(",", "."))))
                except (ValueError, TypeError):
                    return s

            rows = [r for r in rows if _sid(r.get("station_id")) in allowed_station_ids]
        print(f"     Станций: {len(rows)}")

        if save_excel and param == "level":
            _download_excel(driver)

    finally:
        driver.quit()

    return rows, messages


def _download_excel(driver: webdriver.Chrome) -> None:
    """Скачивает Excel через прямой URL из кнопки downloadData."""
    import requests as req
    try:
        btn = WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.ID, "downloadData"))
        )
        driver.execute_script("arguments[0].removeAttribute('disabled');", btn)
        time.sleep(2)
        href = btn.get_attribute("href")
        print(f"     Excel URL: {href}")

        if href and ("session" in href or href.startswith("http")):
            # Получаем cookies из браузера для авторизованного запроса
            cookies = {c['name']: c['value'] for c in driver.get_cookies()}
            r = req.get(href, cookies=cookies, timeout=60)
            print(f"     HTTP статус: {r.status_code}, размер: {len(r.content):,} байт")
            if r.status_code == 200 and len(r.content) > 500:
                p = os.path.join(OUTPUT_DIR, "hydro_data.xlsx")
                with open(p, "wb") as f:
                    f.write(r.content)
                print(f"     Excel сохранён: hydro_data.xlsx")
                return

        print("     Excel: не удалось скачать через прямой URL")
    except Exception as e:
        print(f"     Excel ошибка: {e}")


# ─────────────────────────────────────────────────────────────
# Главная
# ─────────────────────────────────────────────────────────────

def main():
    print("=" * 58)
    print("  Гидрологический мониторинг Казахстана — Парсер")
    print(f"  {BASE_URL}")
    print("=" * 58)

    all_rows     = []
    all_messages = []

    allowed: frozenset[str] | None = None
    if os.environ.get("HYDRO_SCRAPE_ALL_STATIONS", "").lower() not in ("1", "true", "yes"):
        _backend = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        if _backend not in sys.path:
            sys.path.insert(0, _backend)
        try:
            from database.hydro_allowed_stations import ALLOWED_HYDRO_STATION_IDS

            allowed = ALLOWED_HYDRO_STATION_IDS
            print("  Режим: только 25 гидропостов из приложения (/app/stations). "
                  "Все посты: HYDRO_SCRAPE_ALL_STATIONS=1")
        except Exception:
            pass

    save_xlsx = os.environ.get("HYDRO_CLI_SAVE_EXCEL", "").lower() in ("1", "true", "yes")
    for param in ("level", "discharge"):
        rows, msgs = scrape(param, save_excel=save_xlsx, allowed_station_ids=allowed)
        for r in rows:
            r["param"] = param
        all_rows.extend(rows)
        all_messages.extend(msgs)

    # ── Сохранение ────────────────────────────────────────
    if all_rows:
        df = pd.DataFrame(all_rows)

        path_all = os.path.join(OUTPUT_DIR, "stations_all.csv")
        df.to_csv(path_all, index=False, encoding="utf-8-sig")
        print(f"\n  [CSV] Все данные: {len(df)} строк -> stations_all.csv")

        for param in df["param"].unique():
            sub = df[df["param"] == param]
            p = os.path.join(OUTPUT_DIR, f"stations_{param}.csv")
            sub.to_csv(p, index=False, encoding="utf-8-sig")
            print(f"  [CSV] {param}: {len(sub)} строк -> stations_{param}.csv")

        print("\n  Предпросмотр (первые 3 строки, level):")
        preview = df[df["param"] == "level"].head(3)
        pd.set_option("display.max_columns", 10)
        pd.set_option("display.width", 130)
        pd.set_option("display.max_colwidth", 35)
        print(preview.to_string(index=False))
    else:
        print("\n  [!] Данные не получены.")

    # ── Сырые сообщения ───────────────────────────────────
    raw_path = os.path.join(OUTPUT_DIR, "raw_messages.json")
    with open(raw_path, "w", encoding="utf-8") as f:
        json.dump(all_messages, f, ensure_ascii=False, indent=2)
    print(f"\n  [JSON] WS-сообщений: {len(all_messages)} -> raw_messages.json")

    # ── Итог ──────────────────────────────────────────────
    print("\n" + "=" * 58)
    print(f"  Результаты в: {OUTPUT_DIR}")
    for fn in sorted(os.listdir(OUTPUT_DIR)):
        fp = os.path.join(OUTPUT_DIR, fn)
        sz = os.path.getsize(fp)
        print(f"    {fn:<42s}  {sz:>10,} байт")
    print("=" * 58)


if __name__ == "__main__":
    # UTF-8 в консоли Windows только при CLI-запуске (не трогаем stdout при import из FastAPI)
    if hasattr(sys.stdout, "buffer"):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "buffer"):
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    main()
