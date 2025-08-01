// frontend/src/components/page/HecRasViewer.jsx
// -------------------------------------------------
// Упрощённая версия без блоков «water‑depth» и «area info»
// -------------------------------------------------

import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useParams } from 'react-router-dom';
import './HecRasViewer.css';

// TODO: замените на свой Mapbox access token
mapboxgl.accessToken = 'pk.eyJ1Ijoibml4Y3JhenkiLCJhIjoiY21idGF4MnQ4MDFsMTJrcjNzemp1eGltaSJ9.fgZs38bKC670R1P4nXZ9kw';

export default function HecRasViewer() {
  const { projectHash }     = useParams();

  /* ---------- refs ---------- */
  const mapContainer        = useRef(null);
  const sliderRef           = useRef(null);
  const legendRef           = useRef(null);
  const playIntervalRef     = useRef(null);
  const mapRef              = useRef(null);

  /* ---------- state ---------- */
  const [layers, setLayers]     = useState([]);   // {id, title, table}
  const [metadata, setMetadata] = useState(null);
  const [curIndex, setCurIndex] = useState(0);

  /* ---------- helpers ---------- */
  const showLayer = useCallback(
    idx => {
      const m = mapRef.current;
      if (!m || !layers[idx]) return;

      layers.forEach((l, i) => {
        if (m.getLayer(l.id)) {
          m.setLayoutProperty(l.id, 'visibility', i === idx ? 'visible' : 'none');
        }
      });
    },
    [layers]
  );

  /* ---------- map init ---------- */
  useEffect(() => {
    if (mapRef.current) return;           // уже инициализировано

    const m = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [82.6, 48.5],
      zoom: 6,
      pitch: 60,
      bearing: -17.6,
    });
    mapRef.current = m;

    m.addControl(new mapboxgl.NavigationControl());

    m.on('load', () => {
      addTerrain(m);
      loadProject(m);
    });

    // clean‑up
    return () => {
      m.remove();
      mapRef.current = null;
    };
  }, []);

  /* ---------- fetch project ---------- */
  async function loadProject(m) {
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`/api/hec-ras/${projectHash}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data        = await res.json();
      const layersData  = data.layers ?? [];
      const meta        = data.metadata ?? {};

      setMetadata(meta);
      setupLayers(m, layersData, meta);
      showLegend(meta);
    } catch (err) {
      console.error('Failed to load project:', err);
    }
  }

  /* ---------- terrain & sky ---------- */
  function addTerrain(m) {
    if (m.getSource('mapbox-dem')) return;
    m.addSource('mapbox-dem', {
      type: 'raster-dem',
      url: 'mapbox://mapbox.terrain-rgb',
      tileSize: 512,
      maxzoom: 14,
    });
    m.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
    m.addLayer({
      id: 'sky',
      type: 'sky',
      paint: {
        'sky-type': 'atmosphere',
        'sky-atmosphere-sun': [0, 0],
        'sky-atmosphere-sun-intensity': 15,
      },
    });
  }

  /* ---------- layers ---------- */
  function setupLayers(m, arr, meta) {
    const lst = [];
    arr.forEach(layer => {
      const id = layer.layerid;
      if (!m.getSource(id)) {
        m.addSource(id, {
          type: 'raster',
          tiles: [`/api/tiles/${id}/{z}/{x}/{y}.png`],
          tileSize: 256,
        });
      }
      if (!m.getLayer(id)) {
        m.addLayer({
          id,
          type: 'raster',
          source: id,
          layout: { visibility: 'none' },
          paint: { 'raster-opacity': 0.6 },
        });
      }
      lst.push({ id, title: layer.time, table: layer.table });
    });
    setLayers(lst);

    // слайдер
    if (sliderRef.current) {
      sliderRef.current.max   = Math.max(0, lst.length - 1);
      sliderRef.current.value = 0;
    }

    // фокус карты на первом слое
    if (lst.length && meta) {
      const first = lst[0];
      const b     = [
        [meta[`${first.table}_left`],  meta[`${first.table}_bottom`]],
        [meta[`${first.table}_right`], meta[`${first.table}_top`]],
      ];
      if (b.flat().every(v => v != null)) {
        m.fitBounds(b, { padding: 20 });
      }
    }
  }

  /* ---------- legend ---------- */
  function showLegend(meta) {
    if (!meta || !legendRef.current) return;
    const key = Object.keys(meta).find(k => k.endsWith('_legend_values'));
    if (!key) return;
    const base = key.replace('_legend_values', '');
    const vals = meta[`${base}_legend_values`].split(',');
    const cols = meta[`${base}_legend_rgba`].split(',');
    legendRef.current.innerHTML = vals
      .map((v, i) => {
        const rgba = `rgba(${cols[i * 4]}, ${cols[i * 4 + 1]}, ${cols[i * 4 + 2]}, ${cols[i * 4 + 3] / 255})`;
        return `<li style="display:flex;align-items:center">
                  <div style="width:20px;height:20px;background:${rgba};margin-right:5px"></div>
                  <span>${v}</span>
                </li>`;
      })
      .join('');
  }

  /* ---------- effects ---------- */
  // показать 1‑й слой, когда массив слоёв загрузился
  useEffect(() => {
    if (layers.length) showLayer(0);
  }, [layers, showLayer]);

  // переключение слоя при движении слайдера
  useEffect(() => {
    showLayer(curIndex);
  }, [curIndex, showLayer]);

  /* ---------- play / pause ---------- */
  function togglePlay() {
    const btn = document.getElementById('play-button');
    if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
      playIntervalRef.current = null;
      btn.textContent = '▶';
    } else {
      btn.textContent = '❚❚';
      playIntervalRef.current = setInterval(() => {
        setCurIndex(prev => {
          const next = prev + 1 >= layers.length ? 0 : prev + 1;
          if (sliderRef.current) sliderRef.current.value = next;
          return next;
        });
      }, 1000);
    }
  }

  /* ---------- JSX ---------- */
  return (
    <div>
      {/* карта */}
      <div ref={mapContainer} id="map" />

      {/* выбор базового стиля */}
      <select
        id="basemap-select"
        onChange={e => {
          const m = mapRef.current;
          if (!m) return;
          const style = `mapbox://styles/mapbox/${e.target.value}`;
          m.setStyle(style);
          m.once('style.load', () => {
            addTerrain(m);
            if (metadata && layers.length) {
              setupLayers(m, layers, metadata);
              showLegend(metadata);
              showLayer(curIndex);
            }
          });
        }}
      >
        <option value="streets-v12">Streets</option>
        <option value="satellite-v9">Satellite</option>
        <option value="satellite-streets-v12">Hybrid</option>
      </select>

      {/* легенда */}
      <div id="map-legend">
        <ul ref={legendRef} />
      </div>

      {/* слайдер времени */}
      <div id="time-slider-container">
        <button id="play-button" onClick={togglePlay}>
          ▶
        </button>
        <input
          id="time-slider"
          type="range"
          ref={sliderRef}
          min="0"
          defaultValue="0"
          onInput={e => setCurIndex(Number(e.target.value))}
        />
        <div id="time-label">{layers[curIndex]?.title ?? ''}</div>
      </div>
    </div>
  );
}
