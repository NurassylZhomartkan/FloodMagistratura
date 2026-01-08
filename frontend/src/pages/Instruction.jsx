import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Box,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  Typography,
} from "@mui/material";
import { usePageTitle } from '../utils/usePageTitle';
import PageContainer from '../components/layout/PageContainer';
import { useTranslation } from 'react-i18next';

export default function Instruction() {
  const { t } = useTranslation();
  usePageTitle('pageTitles.instruction');
  const sections = useMemo(
    () => [
      { id: "item-1", label: "Item 1", level: 0 },
      { id: "item-1-1", label: "Item 1-1", level: 1 },
      { id: "item-1-2", label: "Item 1-2", level: 1 },
      { id: "item-2", label: "Item 2", level: 0 },
      { id: "item-3", label: "Item 3", level: 0 },
      { id: "item-3-1", label: "Item 3-1", level: 1 },
      { id: "item-3-2", label: "Item 3-2", level: 1 },
    ],
    []
  );

  const [activeIds, setActiveIds] = useState(new Set(["item-3", "item-3-2"]));
  const containerRef = useRef(null);
  const itemRefs = useRef({}); // id -> HTMLElement

  const registerSectionRef = useCallback((id) => (el) => {
    if (el) itemRefs.current[id] = el;
  }, []);

  const scrollTo = useCallback((id) => {
    const el = itemRefs.current[id];
    const container = containerRef.current;
    if (!el || !container) return;

    const top = el.offsetTop;
    container.scrollTo({ top: Math.max(top - 8, 0), behavior: "smooth" });
  }, []);

  // Начальная прокрутка к Item 3-2 при загрузке
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollTo("item-3-2");
    }, 100);
    return () => clearTimeout(timer);
  }, [scrollTo]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Функция для поиска родительского элемента
    const findParent = (sectionId) => {
      const currentIndex = sections.findIndex((s) => s.id === sectionId);
      if (currentIndex === -1) return null;
      
      const currentSection = sections[currentIndex];
      if (currentSection.level === 0) return null;
      
      // Ищем ближайший элемент уровня 0 перед текущим
      for (let i = currentIndex - 1; i >= 0; i--) {
        if (sections[i].level === 0) {
          return sections[i].id;
        }
      }
      return null;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0));

        if (visible.length > 0) {
          const newActiveIds = new Set();
          visible.forEach((entry) => {
            if (entry.target?.id) {
              newActiveIds.add(entry.target.id);
              // Если это дочерний элемент, добавляем родительский тоже
              const parentId = findParent(entry.target.id);
              if (parentId) {
                newActiveIds.add(parentId);
              }
            }
          });
          setActiveIds(newActiveIds);
        }
      },
      {
        root: container,
        rootMargin: "-20% 0px -70% 0px",
        threshold: [0.1, 0.25, 0.5, 0.75, 1],
      }
    );

    sections.forEach(({ id }) => {
      const el = itemRefs.current[id];
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [sections]);

  const renderSection = (id, title, variant = "h5") => {
    const isItem32 = id === "item-3-2";
    return (
      <Box
        id={id}
        ref={registerSectionRef(id)}
        sx={{ scrollMarginTop: 8, mb: 3 }}
      >
        {isItem32 && (
          <Typography variant="body1" sx={{ mb: 2, color: "text.secondary" }}>
            Keep in mind that the JavaScript plugin tries to pick the right element among all that may be visible. Multiple visible scrollspy targets at the same time may cause some issues.
          </Typography>
        )}
        <Typography variant={variant} sx={{ fontWeight: 700, mb: 1 }}>
          {title}
        </Typography>
        <Typography variant="body1" sx={{ mb: 2, color: "text.secondary" }}>
          {isItem32
            ? "This is some placeholder content for the scrollspy page. Note that as you scroll down the page, the appropriate navigation link is highlighted. It's repeated throughout the component example. We keep adding some more example copy here to emphasize the scrolling and highlighting."
            : "This is some placeholder content for the scrollspy page. Note that as you scroll down the page, the appropriate navigation link is highlighted. It's repeated throughout the component example. We keep adding some more example copy here to emphasize the scrolling and highlighting."}
        </Typography>
        {isItem32 && (
          <Typography variant="body1" sx={{ color: "text.secondary" }}>
            Keep in mind that the JavaScript plugin tries to pick the right element among all that may be visible. Multiple visible scrollspy targets at the same time may cause some issues.
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <PageContainer>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: 'bold' }}>
        {t('pageTitles.instruction')}
      </Typography>
      <Box
        sx={{
          p: 3,
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
      <Paper
        elevation={0}
        sx={{
          display: "flex",
          width: "100%",
          maxWidth: 1200,
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "white",
        }}
      >
        {/* Left navigation */}
        <Box
          sx={{
            width: 280,
            flex: "0 0 auto",
            p: 2,
            borderRight: "1px solid",
            borderColor: "divider",
            bgcolor: "white",
          }}
        >
          <List dense sx={{ p: 0 }}>
            {sections.map((s) => {
              const isActive = activeIds.has(s.id);
              return (
                <ListItemButton
                  key={s.id}
                  onClick={() => scrollTo(s.id)}
                  sx={{
                    pl: s.level === 0 ? 1.5 : 4,
                    borderRadius: 1.5,
                    mb: 0.5,
                    bgcolor: isActive ? "primary.main" : "transparent",
                    color: isActive ? "white" : "primary.main",
                    "&:hover": {
                      bgcolor: isActive ? "primary.dark" : "action.hover",
                    },
                    transition: "all 0.2s ease",
                  }}
                >
                  <ListItemText
                    primary={s.label}
                    primaryTypographyProps={{
                      fontSize: 14,
                      fontWeight: 400,
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        </Box>

        {/* Right content */}
        <Box
          ref={containerRef}
          sx={{
            flex: "1 1 auto",
            p: 3,
            height: 600,
            overflowY: "auto",
            bgcolor: "white",
          }}
        >
          {renderSection("item-1", "Item 1", "h5")}
          {renderSection("item-1-1", "Item 1-1", "h6")}
          {renderSection("item-1-2", "Item 1-2", "h6")}
          {renderSection("item-2", "Item 2", "h5")}
          {renderSection("item-3", "Item 3", "h5")}
          {renderSection("item-3-1", "Item 3-1", "h6")}
          {renderSection("item-3-2", "Item 3-2", "h6")}
        </Box>
      </Paper>
    </Box>
    </PageContainer>
  );
}

