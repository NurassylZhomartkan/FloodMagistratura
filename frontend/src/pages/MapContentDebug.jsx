// frontend/src/components/page/MapContentDebug.jsx
// Компонент для отображения содержимого карты проекта

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Paper, Accordion, AccordionSummary, AccordionDetails, CircularProgress } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PageContainer from '../components/layout/PageContainer';

export default function MapContentDebug() {
  const { projectHash } = useParams();
  const [data, setData] = useState({
    metadata: null,
    times: null,
    legend: null,
    properties: null,
    loading: true
  });

  useEffect(() => {
    if (!projectHash) return;

    const token = localStorage.getItem('token');
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    const loadAll = async () => {
      const newData = { loading: false };

      // 1. Метаданные карты
      try {
        const res = await fetch(`/api/map/metadata/${projectHash}`, { headers });
        if (res.ok) {
          newData.metadata = await res.json();
        } else {
          newData.metadata = { error: `HTTP ${res.status}: ${await res.text()}` };
        }
      } catch (err) {
        newData.metadata = { error: err.message };
      }

      // 2. Времена
      try {
        const res = await fetch(`/api/map/times/${projectHash}`, { headers });
        if (res.ok) {
          newData.times = await res.json();
        } else if (res.status === 404) {
          newData.times = { message: 'Времена не найдены (проект не имеет временных данных)' };
        } else {
          newData.times = { error: `HTTP ${res.status}: ${await res.text()}` };
        }
      } catch (err) {
        newData.times = { error: err.message };
      }

      // 3. Легенда
      try {
        const res = await fetch(`/api/uploads/${projectHash}/legend`, { headers });
        if (res.ok) {
          newData.legend = await res.json();
        } else {
          newData.legend = { error: `HTTP ${res.status}: ${await res.text()}` };
        }
      } catch (err) {
        newData.legend = { error: err.message };
      }

      // 4. Свойства проекта
      try {
        const res = await fetch(`/api/hec-ras/${projectHash}/properties`, { headers });
        if (res.ok) {
          newData.properties = await res.json();
        } else {
          newData.properties = { error: `HTTP ${res.status}: ${await res.text()}` };
        }
      } catch (err) {
        newData.properties = { error: err.message };
      }

      setData(newData);
    };

    loadAll();
  }, [projectHash]);

  if (data.loading) {
    return (
      <PageContainer>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>Загрузка данных карты...</Typography>
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Содержимое карты проекта: {projectHash}
      </Typography>

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">1. Метаданные карты</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
              {JSON.stringify(data.metadata, null, 2)}
            </pre>
          </Paper>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">2. Времена</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
              {JSON.stringify(data.times, null, 2)}
            </pre>
          </Paper>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">3. Легенда</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
              {JSON.stringify(data.legend, null, 2)}
            </pre>
          </Paper>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">4. Свойства проекта</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Paper sx={{ p: 2, bgcolor: '#f5f5f5' }}>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
              {JSON.stringify(data.properties, null, 2)}
            </pre>
          </Paper>
        </AccordionDetails>
      </Accordion>
    </PageContainer>
  );
}



