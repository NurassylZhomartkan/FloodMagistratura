# backend/database/utils.py

import os
import sqlite3
import logging
import math
from typing import Dict, List, Any, Optional, Tuple


def extract_hecras_data(db_path: str) -> Dict[str, Any]:
    """
    Извлекает метаданные и слои из базы данных HEC-RAS.
    
    HEC-RAS хранит тайлы в таблицах формата:
    - tiles (общая таблица) или {layer_name}_tiles
    - Колонки: zoom_level, tile_column, tile_row, tile_data
    
    Метаданные могут храниться в таблицах:
    - metadata, tiles_metadata, или в отдельных таблицах для каждого слоя
    
    Возвращает словарь с ключами:
    - metadata: словарь метаданных
    - layers: список слоев с информацией о времени и таблицах
    """
    if not db_path:
        return {"metadata": {}, "layers": []}
    
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        metadata = {}
        layers = []
        
        try:
            # Получаем список всех таблиц
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            )
            tables = [row[0] for row in cursor.fetchall()]
            
            logging.info(f"Found tables in {db_path}: {tables}")
            
            # Ищем таблицы с тайлами
            # HEC-RAS может использовать формат: tiles, {layer}_tiles, или просто имена слоев
            tile_tables = []
            for table in tables:
                # Проверяем, есть ли в таблице колонки для тайлов
                try:
                    cursor = conn.execute(f"PRAGMA table_info({table})")
                    columns = [row[1] for row in cursor.fetchall()]
                    
                    # Если есть колонки для тайлов
                    if 'zoom_level' in columns and 'tile_column' in columns and 'tile_row' in columns:
                        tile_tables.append(table)
                        
                        # Пробуем определить имя слоя из таблицы
                        layer_name = table.replace('_tiles', '').replace('tiles', '').strip()
                        if not layer_name:
                            layer_name = table
                        
                        # Пробуем найти информацию о времени/профиле
                        # Может быть в отдельной таблице или в метаданных
                        time_value = layer_name
                        
                        # Ищем таблицу с метаданными для этого слоя
                        meta_table = f"{layer_name}_metadata" if layer_name != table else "metadata"
                        if meta_table in tables:
                            try:
                                cursor = conn.execute(f"SELECT * FROM {meta_table} LIMIT 1")
                                meta_row = cursor.fetchone()
                                if meta_row:
                                    # Извлекаем время из метаданных
                                    for col in cursor.description:
                                        col_name = col[0]
                                        if 'time' in col_name.lower() or 'profile' in col_name.lower():
                                            time_value = str(meta_row[col_name]) if meta_row[col_name] else time_value
                            except sqlite3.Error:
                                pass
                        
                        layers.append({
                            "layerid": layer_name,
                            "time": time_value,
                            "table": layer_name
                        })
                        
                        logging.info(f"Found layer: {layer_name} in table {table}")
                except sqlite3.Error as e:
                    logging.debug(f"Error checking table {table}: {e}")
                    continue
            
            # Если не нашли слои в таблицах тайлов, пробуем найти любые таблицы с данными
            if not layers:
                # Ищем таблицы, которые могут содержать данные о слоях
                for table in tables:
                    if table not in ['sqlite_sequence', 'sqlite_master']:
                        try:
                            # Проверяем, есть ли данные в таблице
                            cursor = conn.execute(f"SELECT COUNT(*) as cnt FROM {table}")
                            count = cursor.fetchone()['cnt']
                            if count > 0:
                                layers.append({
                                    "layerid": table,
                                    "time": table,
                                    "table": table
                                })
                                logging.info(f"Added layer from table {table}")
                        except sqlite3.Error:
                            continue
            
            # Извлекаем метаданные используя единый метод load_metadata_from_db
            # Это гарантирует, что метаданные читаются одинаково везде
            try:
                # Используем load_metadata_from_db для чтения метаданных
                # Это гарантирует единообразие с endpoint легенды
                file_metadata = load_metadata_from_db(db_path)
                if file_metadata:
                    metadata.update(file_metadata)
                    # Логируем все извлеченные метаданные для отладки
                    metadata_keys = list(metadata.keys())
                    logging.info(f"Extracted {len(metadata_keys)} metadata entries from metadata table")
                    # Логируем ключи с префиксом (например, Maleevsk_)
                    prefixed_keys = [k for k in metadata_keys if '_' in k and k.split('_')[0] in metadata_keys or any(k.startswith(p) for p in ['Maleevsk_', 'P_', 'Project_'])]
                    if prefixed_keys:
                        logging.info(f"Found prefixed metadata keys: {prefixed_keys[:10]}...")  # Первые 10 для краткости
                    legend_keys = [k for k in metadata_keys if 'legend' in k.lower()]
                    logging.info(f"Extracted {len(legend_keys)} legend entries from metadata table: {legend_keys}")
                    # Логируем все ключи метаданных для проверки
                    logging.debug(f"All metadata keys: {metadata_keys}")
            except Exception as e:
                logging.warning(f"Error loading metadata using load_metadata_from_db: {e}")
                # Fallback: старый метод чтения метаданных
                metadata_tables = [t for t in tables if 'meta' in t.lower() or 'info' in t.lower() or t == 'metadata']
                
                for table_name in metadata_tables:
                    try:
                        cursor = conn.execute(f"SELECT * FROM {table_name}")
                        rows = cursor.fetchall()
                        column_names = [col[0] for col in cursor.description]
                        
                        logging.info(f"Reading metadata from {table_name}, columns: {column_names}, rows: {len(rows)}")
                        
                        # Проверяем формат таблицы: name-value или колонки
                        if 'name' in column_names and 'value' in column_names:
                            # Формат name-value (JSON)
                            for row in rows:
                                name_idx = column_names.index('name')
                                value_idx = column_names.index('value')
                                name = row[name_idx]
                                value = row[value_idx]
                                if name and value is not None:
                                    metadata[name] = value
                                    logging.debug(f"Added metadata: {name} = {value[:50] if isinstance(value, str) and len(value) > 50 else value}")
                        else:
                            # Формат с колонками
                            for row in rows:
                                for col_name, value in zip(column_names, row):
                                    if value is not None:
                                        metadata[col_name] = value
                        
                        legend_keys = [k for k in metadata.keys() if 'legend' in k.lower()]
                        logging.info(f"Extracted {len(legend_keys)} legend entries from {table_name}: {legend_keys}")
                    except sqlite3.Error as e:
                        logging.error(f"Error reading metadata from {table_name}: {e}")
                        continue
            
            # Если метаданные не найдены, создаем базовые на основе первого слоя
            if not metadata and layers:
                first_layer = layers[0]
                table_name = first_layer['table']
                
                # Пробуем получить границы из тайлов
                try:
                    # Находим таблицу тайлов для первого слоя
                    tile_table = None
                    for t in tables:
                        if table_name in t.lower() and 'tile' in t.lower():
                            tile_table = t
                            break
                    if not tile_table:
                        tile_table = 'tiles'
                    
                    if tile_table in tables:
                        # Получаем минимальный и максимальный zoom level
                        cursor = conn.execute(f"SELECT MIN(zoom_level) as min_z, MAX(zoom_level) as max_z FROM {tile_table}")
                        zoom_info = cursor.fetchone()
                        
                        # Получаем границы из тайлов на минимальном zoom
                        if zoom_info and zoom_info['min_z'] is not None:
                            min_z = zoom_info['min_z']
                            cursor = conn.execute(
                                f"SELECT MIN(tile_column) as min_x, MAX(tile_column) as max_x, "
                                f"MIN(tile_row) as min_y, MAX(tile_row) as max_y "
                                f"FROM {tile_table} WHERE zoom_level = ?",
                                (min_z,)
                            )
                            bounds = cursor.fetchone()
                            
                            if bounds and bounds['min_x'] is not None:
                                # Конвертируем тайловые координаты в географические
                                # Это приблизительная конвертация
                                n = 2.0 ** min_z
                                metadata[f"{table_name}_left"] = (bounds['min_x'] / n) * 360.0 - 180.0
                                metadata[f"{table_name}_right"] = ((bounds['max_x'] + 1) / n) * 360.0 - 180.0
                                metadata[f"{table_name}_bottom"] = (1 - (bounds['max_y'] + 1) / n) * 180.0 - 90.0
                                metadata[f"{table_name}_top"] = (1 - bounds['min_y'] / n) * 180.0 - 90.0
                except sqlite3.Error as e:
                    logging.debug(f"Error calculating bounds: {e}")
                
                # Создаем базовую легенду
                if f"{table_name}_legend_values" not in metadata:
                    metadata[f"{table_name}_legend_values"] = "0,0.5,1,1.5,2,2.5,3"
                    metadata[f"{table_name}_legend_rgba"] = "0,0,255,255,0,100,255,255,0,200,255,255,0,255,0,255,255,255,0,255,255,165,0,255,255,0,0,255"
            
            logging.info(f"Extracted {len(layers)} layers and {len(metadata)} metadata entries")
            
        finally:
            conn.close()
            
        return {
            "metadata": metadata,
            "layers": layers
        }
        
    except Exception as e:
        logging.error(f"Error extracting HEC-RAS data from {db_path}: {e}")
        import traceback
        logging.error(traceback.format_exc())
        return {"metadata": {}, "layers": []}


def detect_tile_schema(db_path: str) -> Dict[str, Any]:
    """
    Определяет схему тайлов в SQLite .db файле.
    
    Возвращает словарь с полями:
    - tile_table: имя таблицы с тайлами
    - z_col: имя колонки для zoom level
    - x_col: имя колонки для tile column
    - y_col: имя колонки для tile row
    - data_col: имя колонки для tile data (blob)
    - time_col: имя колонки для времени (если есть, иначе None)
    
    Правила определения:
    - z: zoom_level | z | zoom
    - x: tile_column | x | column
    - y: tile_row | y | row
    - data: tile_data | data | blob
    - time: time | timestamp | datetime
    
    Предпочтение отдается таблице с именем 'tiles' если она существует.
    
    Raises:
        ValueError: если не найдена подходящая таблица с тайлами
    """
    if not db_path:
        raise ValueError("db_path is required")
    
    # Открываем базу данных в режиме только чтения
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    
    try:
        # Получаем список всех таблиц
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        
        if not tables:
            raise ValueError("No tables found in database")
        
        # Словари для сопоставления имен колонок
        z_patterns = ['zoom_level', 'z', 'zoom']
        x_patterns = ['tile_column', 'x', 'column']
        y_patterns = ['tile_row', 'y', 'row']
        data_patterns = ['tile_data', 'data', 'blob']
        time_patterns = ['time', 'timestamp', 'datetime']
        
        best_match = None
        best_score = 0
        
        # Проверяем каждую таблицу
        for table_name in tables:
            # Получаем информацию о колонках
            cursor = conn.execute(f"PRAGMA table_info({table_name})")
            columns_info = cursor.fetchall()
            
            column_names = [row[1] for row in columns_info]
            column_names_lower = [name.lower() for name in column_names]
            column_types = {row[1].lower(): row[2].lower() for row in columns_info}
            
            # Ищем совпадения для каждой колонки
            z_col = None
            x_col = None
            y_col = None
            data_col = None
            time_col = None
            
            for col_name in column_names:
                col_lower = col_name.lower()
                
                # Проверяем z
                if not z_col:
                    for pattern in z_patterns:
                        if pattern in col_lower:
                            z_col = col_name
                            break
                
                # Проверяем x
                if not x_col:
                    for pattern in x_patterns:
                        if pattern in col_lower:
                            x_col = col_name
                            break
                
                # Проверяем y
                if not y_col:
                    for pattern in y_patterns:
                        if pattern in col_lower:
                            y_col = col_name
                            break
                
                # Проверяем data (обычно blob)
                if not data_col:
                    for pattern in data_patterns:
                        if pattern in col_lower:
                            # Проверяем, что это действительно blob
                            if 'blob' in column_types.get(col_lower, '') or pattern == 'blob':
                                data_col = col_name
                                break
                
                # Проверяем time (опционально)
                if not time_col:
                    for pattern in time_patterns:
                        if pattern in col_lower:
                            time_col = col_name
                            break
            
            # Вычисляем score для этой таблицы
            score = 0
            if z_col and x_col and y_col and data_col:
                score = 4  # Базовые колонки найдены
                if time_col:
                    score += 1  # Бонус за time колонку
                if table_name.lower() == 'tiles':
                    score += 2  # Бонус за стандартное имя таблицы
            
            # Сохраняем лучшее совпадение
            if score > best_score:
                best_score = score
                best_match = {
                    'tile_table': table_name,
                    'z_col': z_col,
                    'x_col': x_col,
                    'y_col': y_col,
                    'data_col': data_col,
                    'time_col': time_col if time_col else None
                }
        
        if not best_match or best_score < 4:
            raise ValueError("No tile table detected in db. Required columns: z, x, y, data")
        
        logging.info(f"Detected tile schema: {best_match}")
        return best_match
        
    finally:
        conn.close()


def tile_to_lonlat(x: int, y: int, z: int) -> Tuple[float, float]:
    """
    Конвертирует тайловые координаты (XYZ Web Mercator) в долготу и широту.
    
    Args:
        x: tile column
        y: tile row
        z: zoom level
    
    Returns:
        Tuple[lon, lat]
    """
    n = 2.0 ** z
    lon = x / n * 360.0 - 180.0
    lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * y / n)))
    lat = math.degrees(lat_rad)
    return lon, lat


def compute_bounds_from_tiles(db_path: str, schema: Dict[str, Any]) -> Dict[str, Any]:
    """
    Вычисляет границы (bounds) из тайлов в базе данных.
    
    Args:
        db_path: путь к файлу базы данных
        schema: схема тайлов (результат detect_tile_schema)
    
    Returns:
        Словарь с полями: bounds, center, minzoom, maxzoom
    """
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    
    try:
        table = schema['tile_table']
        z_col = schema['z_col']
        x_col = schema['x_col']
        y_col = schema['y_col']
        
        # Получаем minzoom и maxzoom
        cursor = conn.execute(f"SELECT MIN({z_col}) as min_z, MAX({z_col}) as max_z FROM {table}")
        zoom_info = cursor.fetchone()
        
        minzoom = zoom_info['min_z'] if zoom_info['min_z'] is not None else 0
        maxzoom = zoom_info['max_z'] if zoom_info['max_z'] is not None else 18
        
        # Вычисляем границы на максимальном zoom level
        z_max = maxzoom
        cursor = conn.execute(
            f"SELECT MIN({x_col}) as min_x, MAX({x_col}) as max_x, "
            f"MIN({y_col}) as min_y, MAX({y_col}) as max_y "
            f"FROM {table} WHERE {z_col} = ?",
            (z_max,)
        )
        bounds_info = cursor.fetchone()
        
        if bounds_info and bounds_info['min_x'] is not None:
            min_x = bounds_info['min_x']
            max_x = bounds_info['max_x']
            min_y = bounds_info['min_y']
            max_y = bounds_info['max_y']
            
            # Конвертируем в lon/lat
            west, north = tile_to_lonlat(min_x, min_y, z_max)
            east, south = tile_to_lonlat(max_x + 1, max_y + 1, z_max)
            
            center_lon = (west + east) / 2
            center_lat = (north + south) / 2
            
            return {
                'bounds': [west, south, east, north],
                'center': [center_lon, center_lat],
                'minzoom': int(minzoom),
                'maxzoom': int(maxzoom)
            }
        else:
            # Если не нашли тайлы, возвращаем значения по умолчанию
            return {
                'bounds': [-180, -85, 180, 85],
                'center': [0, 0],
                'minzoom': 0,
                'maxzoom': 18
            }
            
    finally:
        conn.close()


def load_metadata_from_db(db_path: str) -> Dict[str, str]:
    """
    Загружает метаданные из SQLite БД в режиме только чтения.
    
    Поддерживает таблицы metadata с колонками:
    - (name, value) или (key, value)
    
    Возвращает словарь {key: value} или {} если таблица не найдена.
    """
    if not db_path or not os.path.exists(db_path):
        return {}
    
    metadata = {}
    
    try:
        # Открываем БД в режиме только чтения
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        
        try:
            # Проверяем наличие таблицы metadata
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='metadata'"
            )
            if not cursor.fetchone():
                logging.info(f"Table 'metadata' not found in {db_path}")
                return {}
            
            # Читаем метаданные
            cursor = conn.execute("SELECT * FROM metadata")
            rows = cursor.fetchall()
            column_names = [col[0] for col in cursor.description]
            
            logging.info(f"Reading metadata from {db_path}, columns: {column_names}, rows: {len(rows)}")
            
            # Поддерживаем форматы (name, value) или (key, value)
            if 'name' in column_names and 'value' in column_names:
                name_col = 'name'
                value_col = 'value'
            elif 'key' in column_names and 'value' in column_names:
                name_col = 'key'
                value_col = 'value'
            else:
                logging.warning(f"Metadata table has unsupported columns: {column_names}")
                return {}
            
            for row in rows:
                key = row[name_col]
                value = row[value_col]
                if key and value is not None:
                    # Сохраняем значение как строку, но пытаемся сохранить исходный тип для чисел
                    # Это важно для правильной обработки числовых значений (maxzoom, centerx, и т.д.)
                    if isinstance(value, (int, float)):
                        metadata[key] = value
                    else:
                        # Для строк пытаемся преобразовать в число, если возможно
                        str_value = str(value).strip()
                        try:
                            # Пробуем преобразовать в float (поддерживает и int, и float)
                            if '.' in str_value:
                                metadata[key] = float(str_value)
                            else:
                                metadata[key] = int(str_value)
                        except ValueError:
                            # Если не число, сохраняем как строку
                            metadata[key] = str_value
                    logging.debug(f"Added metadata: {key} = {metadata[key]} (type: {type(metadata[key]).__name__})")
            
        finally:
            conn.close()
            
    except Exception as e:
        logging.error(f"Error loading metadata from {db_path}: {e}")
        return {}
    
    return metadata


def parse_legends_from_metadata(metadata: Dict[str, str]) -> List[Dict[str, Any]]:
    """
    Парсит легенды из метаданных.
    
    Находит все префиксы P, где ключ заканчивается на "_legend_values".
    Для каждого префикса извлекает values и rgba, строит классы.
    
    Возвращает список легенд:
    [
        {
            "key_prefix": "P",
            "title": "Depth",
            "classes": [
                {"label": "0 - 0.5", "rgba": {"r": 156, "g": 21, "b": 31, "a": 255}, "hex": "#9C151F"}
            ]
        }
    ]
    """
    legends = []
    
    # Находим все префиксы, где ключ заканчивается на "_legend_values"
    prefixes = set()
    for key in metadata.keys():
        if key.endswith("_legend_values"):
            prefix = key[:-len("_legend_values")]
            prefixes.add(prefix)
            logging.info(f"Found legend prefix: {prefix} from key: {key}")
    
    if not prefixes:
        logging.warning(f"No legend prefixes found in metadata. Available keys: {list(metadata.keys())[:20]}")
        return []
    
    logging.info(f"Processing {len(prefixes)} legend prefixes: {prefixes}")
    
    for prefix in prefixes:
        values_key = f"{prefix}_legend_values"
        rgba_key = f"{prefix}_legend_rgba"
        
        values_str = metadata.get(values_key)
        rgba_str = metadata.get(rgba_key)
        
        if not values_str or not rgba_str:
            logging.warning(f"Missing values or rgba for prefix {prefix}")
            continue
        
        # Парсим values - извлекаем только числовые значения
        # Убираем возможные диапазоны и берем только числа
        raw_values = [v.strip() for v in values_str.split(",") if v.strip()]
        values = []
        for v in raw_values:
            # Если значение содержит диапазон (например, "0 - 0.5"), берем только последнее число
            if " - " in v or ("-" in v and not v.startswith("-") and v.count("-") == 1):
                # Извлекаем последнее число из диапазона
                # Заменяем " - " на "-" для единообразия
                v_clean = v.replace(" - ", "-")
                # Разбиваем по "-" и берем последнюю часть
                parts = v_clean.split("-")
                # Берем последнюю часть и пытаемся преобразовать в число
                last_part = parts[-1].strip()
                try:
                    num_val = float(last_part)
                    values.append(str(num_val))
                except ValueError:
                    logging.warning(f"Could not extract number from range: {v}, trying as single value")
                    # Пробуем как одно число
                    try:
                        num_val = float(v)
                        values.append(str(num_val))
                    except ValueError:
                        logging.warning(f"Invalid value format: {v}, skipping")
                        continue
            else:
                # Просто число
                try:
                    num_val = float(v)
                    values.append(str(num_val))
                except ValueError:
                    logging.warning(f"Invalid value format: {v}, skipping")
                    continue
        
        if not values:
            logging.warning(f"No valid numeric values found for prefix {prefix} from string: {values_str}")
            continue
        
        # Удаляем дубликаты, сохраняя порядок (сравниваем как числа)
        seen = set()
        unique_values = []
        for v in values:
            try:
                num_val = float(v)
                # Проверяем, не встречали ли мы это число (с небольшой погрешностью)
                is_duplicate = False
                for seen_val in seen:
                    if abs(float(seen_val) - num_val) < 0.0001:
                        is_duplicate = True
                        break
                if not is_duplicate:
                    seen.add(v)
                    unique_values.append(v)
            except ValueError:
                continue
        
        values = unique_values
        logging.info(f"Parsed {len(values)} unique values for prefix {prefix}: {values}")
        
        # Парсим rgba
        rgba_ints = []
        for v in rgba_str.split(","):
            v = v.strip()
            if v:
                try:
                    rgba_ints.append(int(v))
                except ValueError:
                    logging.warning(f"Invalid rgba value: {v}")
                    continue
        
        # Проверяем, что длина rgba кратна 4
        if len(rgba_ints) % 4 != 0:
            logging.warning(f"rgba length ({len(rgba_ints)}) is not multiple of 4 for prefix {prefix}")
            continue
        
        # Разбиваем rgba на группы по 4 (r, g, b, a)
        colors = []
        for i in range(0, len(rgba_ints), 4):
            if i + 3 < len(rgba_ints):
                colors.append({
                    "r": rgba_ints[i],
                    "g": rgba_ints[i + 1],
                    "b": rgba_ints[i + 2],
                    "a": rgba_ints[i + 3]
                })
        
        # Проверяем, что количество цветов равно количеству значений
        if len(colors) != len(values):
            logging.warning(
                f"Color count ({len(colors)}) != values count ({len(values)}) for prefix {prefix}"
            )
            continue
        
        # Строим классы
        # Значения в метаданных обычно представляют верхние границы диапазонов
        # Например: [0.5, 1, 1.5, 2, 2.5, 3] означает диапазоны:
        # 0-0.5, 0.5-1, 1-1.5, 1.5-2, 2-2.5, 2.5-3, >3
        classes = []
        
        # Обрабатываем все значения кроме последнего (они формируют диапазоны)
        for i in range(len(values)):
            color = colors[i]
            value = values[i]
            
            # Формируем label на основе значения
            # Для первого значения: диапазон от 0 до первого значения
            if i == 0:
                label = f"0 - {value}"
            else:
                # Для остальных: диапазон от предыдущего значения до текущего
                prev_value = values[i - 1]
                label = f"{prev_value} - {value}"
            
            # Конвертируем rgba в hex
            hex_color = f"#{color['r']:02X}{color['g']:02X}{color['b']:02X}"
            
            classes.append({
                "label": label,
                "rgba": color,
                "hex": hex_color
            })
        
        # Добавляем класс для значений больше последнего (используем последний цвет)
        if len(colors) > 0 and len(values) > 0:
            last_color = colors[-1]
            last_value = values[-1]
            classes.append({
                "label": f"> {last_value}",
                "rgba": last_color,
                "hex": f"#{last_color['r']:02X}{last_color['g']:02X}{last_color['b']:02X}"
            })
        
        # Получаем title из метаданных
        title = metadata.get(f"{prefix}_map_type", prefix)
        
        legends.append({
            "key_prefix": prefix,
            "title": title,
            "classes": classes
        })
    
    return legends
