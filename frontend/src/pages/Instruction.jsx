import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Box,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  Chip,
  Divider,
  Card,
  CardContent,
  Alert,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import CloudIcon from "@mui/icons-material/Cloud";
import LayersIcon from "@mui/icons-material/Layers";
import GridOnIcon from "@mui/icons-material/GridOn";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import TerrainIcon from "@mui/icons-material/Terrain";
import StorageIcon from "@mui/icons-material/Storage";
import PersonIcon from "@mui/icons-material/Person";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import EmojiPeopleIcon from "@mui/icons-material/EmojiPeople";
import TipsAndUpdatesIcon from "@mui/icons-material/TipsAndUpdates";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { usePageTitle } from "../utils/usePageTitle";
import PageContainer from "../components/layout/PageContainer";
import { useTranslation } from "react-i18next";

const PRIMARY = "#0077B6";
const PRIMARY_DARK = "#023E8A";
const PRIMARY_LIGHT = "#48CAE4";
const PRIMARY_BG = "#E8F4F8";

const PAGE_SECTIONS = [
  { id: "intro",         labelKey: "instruction.intro.title",         level: 0, icon: <EmojiPeopleIcon /> },
  { id: "navigation",    labelKey: "instruction.navigation.title",    level: 0, icon: <HomeIcon /> },
  { id: "dashboard",     labelKey: "instruction.dashboard.title",     level: 1, icon: <HomeIcon /> },
  { id: "weather",       labelKey: "instruction.weather.title",       level: 1, icon: <CloudIcon /> },
  { id: "terrainMap",    labelKey: "instruction.terrainMap.title",    level: 1, icon: <TerrainIcon /> },
  { id: "tools",         labelKey: "instruction.navigation.title",    level: 0, icon: <GridOnIcon />, labelOverride: true },
  { id: "layers",        labelKey: "instruction.layers.title",        level: 1, icon: <LayersIcon /> },
  { id: "hecRas",        labelKey: "instruction.hecRas.title",        level: 1, icon: <GridOnIcon /> },
  { id: "floodModeling", labelKey: "instruction.floodModeling.title", level: 1, icon: <WaterDropIcon /> },
  { id: "database",      labelKey: "instruction.database.title",      level: 0, icon: <StorageIcon /> },
  { id: "profile",       labelKey: "instruction.profile.title",       level: 0, icon: <PersonIcon /> },
  { id: "tips",          labelKey: "instruction.tips.title",          level: 0, icon: <TipsAndUpdatesIcon /> },
];

const PAGE_CARDS = [
  { id: "dashboard",     icon: <HomeIcon sx={{ fontSize: 28 }} />,       color: PRIMARY,       bgColor: PRIMARY_BG },
  { id: "weather",       icon: <CloudIcon sx={{ fontSize: 28 }} />,      color: "#0284C7",     bgColor: "#F0F9FF" },
  { id: "terrainMap",    icon: <TerrainIcon sx={{ fontSize: 28 }} />,    color: "#059669",     bgColor: "#ECFDF5" },
  { id: "layers",        icon: <LayersIcon sx={{ fontSize: 28 }} />,     color: "#D97706",     bgColor: "#FFFBEB" },
  { id: "hecRas",        icon: <GridOnIcon sx={{ fontSize: 28 }} />,     color: "#7C3AED",     bgColor: "#F5F3FF" },
  { id: "floodModeling", icon: <WaterDropIcon sx={{ fontSize: 28 }} />,  color: "#DC2626",     bgColor: "#FEF2F2" },
  { id: "database",      icon: <StorageIcon sx={{ fontSize: 28 }} />,    color: "#64748B",     bgColor: "#F1F5F9" },
  { id: "profile",       icon: <PersonIcon sx={{ fontSize: 28 }} />,     color: PRIMARY_DARK,  bgColor: PRIMARY_BG },
];

export default function Instruction() {
  const { t } = useTranslation();
  usePageTitle("pageTitles.instruction");

  const navSections = useMemo(() => [
    { id: "intro",         label: t("instruction.intro.title"),         level: 0 },
    { id: "navigation",    label: t("instruction.navigation.title"),    level: 0 },
    { id: "dashboard",     label: t("instruction.dashboard.title"),     level: 1 },
    { id: "weather",       label: t("instruction.weather.title"),       level: 1 },
    { id: "terrainMap",    label: t("instruction.terrainMap.title"),    level: 1 },
    { id: "tools",         label: t("app.hecRas") + " & " + t("app.floodModeling"), level: 0 },
    { id: "layers",        label: t("instruction.layers.title"),        level: 1 },
    { id: "hecRas",        label: t("instruction.hecRas.title"),        level: 1 },
    { id: "floodModeling", label: t("instruction.floodModeling.title"), level: 1 },
    { id: "database",      label: t("instruction.database.title"),      level: 0 },
    { id: "profile",       label: t("instruction.profile.title"),       level: 0 },
    { id: "tips",          label: t("instruction.tips.title"),          level: 0 },
  ], [t]);

  const [activeIds, setActiveIds] = useState(new Set(["intro"]));
  const containerRef = useRef(null);
  const itemRefs = useRef({});

  const registerSectionRef = useCallback((id) => (el) => {
    if (el) itemRefs.current[id] = el;
  }, []);

  const scrollTo = useCallback((id) => {
    const el = itemRefs.current[id];
    const container = containerRef.current;
    if (!el || !container) return;
    container.scrollTo({ top: Math.max(el.offsetTop - 16, 0), behavior: "smooth" });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => scrollTo("intro"), 100);
    return () => clearTimeout(timer);
  }, [scrollTo]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const findParent = (sectionId) => {
      const currentIndex = navSections.findIndex((s) => s.id === sectionId);
      if (currentIndex === -1) return null;
      const current = navSections[currentIndex];
      if (current.level === 0) return null;
      for (let i = currentIndex - 1; i >= 0; i--) {
        if (navSections[i].level === 0) return navSections[i].id;
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
              const parentId = findParent(entry.target.id);
              if (parentId) newActiveIds.add(parentId);
            }
          });
          setActiveIds(newActiveIds);
        }
      },
      { root: container, rootMargin: "-15% 0px -65% 0px", threshold: [0.1, 0.5, 1] }
    );

    navSections.forEach(({ id }) => {
      const el = itemRefs.current[id];
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [navSections]);

  const pageCardMap = useMemo(() => {
    const m = {};
    PAGE_CARDS.forEach((c) => { m[c.id] = c; });
    return m;
  }, []);

  const renderPageSection = (id) => {
    const card = pageCardMap[id];
    const titleKey = `instruction.${id}.title`;
    const descKey = `instruction.${id}.description`;
    return (
      <Card
        elevation={0}
        sx={{
          mb: 2,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 3,
          overflow: "hidden",
          transition: "box-shadow 0.2s",
          "&:hover": { boxShadow: "0 4px 16px rgba(0,119,182,0.10)" },
        }}
      >
        <CardContent sx={{ p: 2.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", mb: 1.5, gap: 1.5 }}>
            <Box
              sx={{
                width: 48,
                height: 48,
                borderRadius: 2,
                bgcolor: card?.bgColor || PRIMARY_BG,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: card?.color || PRIMARY,
                flexShrink: 0,
              }}
            >
              {card?.icon}
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary", lineHeight: 1.3 }}>
                {t(titleKey)}
              </Typography>
              <Chip
                label={`/app/${id === "dashboard" ? "" : id === "terrainMap" ? "terrain-map" : id === "hecRas" ? "hec-ras" : id === "floodModeling" ? "flood" : id}`}
                size="small"
                sx={{
                  mt: 0.5,
                  fontSize: "0.7rem",
                  height: 20,
                  bgcolor: card?.bgColor || PRIMARY_BG,
                  color: card?.color || PRIMARY,
                  fontFamily: "monospace",
                  fontWeight: 600,
                }}
              />
            </Box>
          </Box>
          <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.7 }}>
            {t(descKey)}
          </Typography>
        </CardContent>
      </Card>
    );
  };

  const tips = [
    t("instruction.tips.tip1"),
    t("instruction.tips.tip2"),
    t("instruction.tips.tip3"),
    t("instruction.tips.tip4"),
    t("instruction.tips.tip5"),
  ];

  return (
    <PageContainer>
      <Typography variant="h4" sx={{ mb: 2, fontWeight: "bold" }}>
        {t("pageTitles.instruction")}
      </Typography>

      <Box sx={{ display: "flex", gap: 2, height: "calc(100vh - 140px)", minHeight: 0 }}>
        {/* Левая навигация */}
        <Paper
          elevation={0}
          sx={{
            width: 240,
            flexShrink: 0,
            borderRadius: 3,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "white",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Box sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5 }}>
              {t("pageTitles.instruction")}
            </Typography>
          </Box>
          <Box sx={{ overflowY: "auto", flex: 1, p: 1 }}>
            <List dense sx={{ p: 0 }}>
              {navSections.map((s) => {
                const isActive = activeIds.has(s.id);
                return (
                  <ListItemButton
                    key={s.id}
                    onClick={() => scrollTo(s.id)}
                    sx={{
                      pl: s.level === 0 ? 1.5 : 3.5,
                      borderRadius: 2,
                      mb: 0.25,
                      py: 0.75,
                      bgcolor: isActive
                        ? s.level === 0 ? PRIMARY : `${PRIMARY}18`
                        : "transparent",
                      color: isActive
                        ? s.level === 0 ? "white" : PRIMARY
                        : s.level === 0 ? "text.primary" : "text.secondary",
                      "&:hover": {
                        bgcolor: isActive
                          ? s.level === 0 ? PRIMARY_DARK : `${PRIMARY}28`
                          : "action.hover",
                      },
                      transition: "all 0.15s ease",
                    }}
                  >
                    <ListItemText
                      primary={s.label}
                      primaryTypographyProps={{
                        fontSize: s.level === 0 ? 13 : 12,
                        fontWeight: s.level === 0 ? 600 : 400,
                        lineHeight: 1.4,
                      }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        </Paper>

        {/* Правая область контента */}
        <Box
          ref={containerRef}
          sx={{
            flex: 1,
            overflowY: "auto",
            pr: 0.5,
          }}
        >
          {/* Введение */}
          <Box id="intro" ref={registerSectionRef("intro")} sx={{ mb: 3 }}>
            <Paper
              elevation={0}
              sx={{
                p: 3,
                borderRadius: 3,
                background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`,
                color: "white",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  top: -20,
                  right: -20,
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  bgcolor: "rgba(255,255,255,0.08)",
                }}
              />
              <Box
                sx={{
                  position: "absolute",
                  bottom: -40,
                  right: 40,
                  width: 180,
                  height: 180,
                  borderRadius: "50%",
                  bgcolor: "rgba(255,255,255,0.05)",
                }}
              />
              <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, position: "relative" }}>
                {t("instruction.intro.title")}
              </Typography>
              <Typography variant="body1" sx={{ opacity: 0.9, lineHeight: 1.7, maxWidth: 600, position: "relative" }}>
                {t("instruction.intro.description")}
              </Typography>
              <Box sx={{ display: "flex", gap: 1, mt: 2, flexWrap: "wrap" }}>
                {["Dashboard", "Weather", "HEC-RAS", "Flood Modeling", "Terrain Map"].map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    size="small"
                    sx={{
                      bgcolor: "rgba(255,255,255,0.15)",
                      color: "white",
                      fontWeight: 500,
                      fontSize: "0.75rem",
                      backdropFilter: "blur(4px)",
                    }}
                  />
                ))}
              </Box>
            </Paper>
          </Box>

          {/* Раздел: Основная навигация */}
          <Box id="navigation" ref={registerSectionRef("navigation")} sx={{ mb: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <Box sx={{ width: 4, height: 24, bgcolor: PRIMARY, borderRadius: 2 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary" }}>
                {t("instruction.navigation.title")}
              </Typography>
            </Box>
          </Box>

          <Box id="dashboard" ref={registerSectionRef("dashboard")} sx={{ scrollMarginTop: 8 }}>
            {renderPageSection("dashboard")}
          </Box>
          <Box id="weather" ref={registerSectionRef("weather")} sx={{ scrollMarginTop: 8 }}>
            {renderPageSection("weather")}
          </Box>
          <Box id="terrainMap" ref={registerSectionRef("terrainMap")} sx={{ scrollMarginTop: 8, mb: 3 }}>
            {renderPageSection("terrainMap")}
          </Box>

          {/* Раздел: Инструменты */}
          <Box id="tools" ref={registerSectionRef("tools")} sx={{ mb: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <Box sx={{ width: 4, height: 24, bgcolor: "#7C3AED", borderRadius: 2 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary" }}>
                {t("app.layers")} & {t("app.hecRas")}
              </Typography>
            </Box>
          </Box>

          <Box id="layers" ref={registerSectionRef("layers")} sx={{ scrollMarginTop: 8 }}>
            {renderPageSection("layers")}
          </Box>
          <Box id="hecRas" ref={registerSectionRef("hecRas")} sx={{ scrollMarginTop: 8 }}>
            {renderPageSection("hecRas")}
          </Box>
          <Box id="floodModeling" ref={registerSectionRef("floodModeling")} sx={{ scrollMarginTop: 8, mb: 3 }}>
            {renderPageSection("floodModeling")}
          </Box>

          {/* База данных */}
          <Box id="database" ref={registerSectionRef("database")} sx={{ mb: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <Box sx={{ width: 4, height: 24, bgcolor: "#64748B", borderRadius: 2 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary" }}>
                {t("instruction.database.title")}
              </Typography>
            </Box>
            {renderPageSection("database")}
          </Box>

          {/* Профиль */}
          <Box id="profile" ref={registerSectionRef("profile")} sx={{ mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <Box sx={{ width: 4, height: 24, bgcolor: PRIMARY_DARK, borderRadius: 2 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary" }}>
                {t("instruction.profile.title")}
              </Typography>
            </Box>
            {renderPageSection("profile")}
          </Box>

          {/* Советы */}
          <Box id="tips" ref={registerSectionRef("tips")} sx={{ mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <Box sx={{ width: 4, height: 24, bgcolor: "#D97706", borderRadius: 2 }} />
              <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary" }}>
                {t("instruction.tips.title")}
              </Typography>
            </Box>
            <Paper
              elevation={0}
              sx={{
                p: 2.5,
                borderRadius: 3,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "#FFFBEB",
              }}
            >
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {tips.map((tip, i) => (
                  <Box key={i} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                    <CheckCircleOutlineIcon
                      sx={{ color: "#D97706", fontSize: 20, mt: 0.1, flexShrink: 0 }}
                    />
                    <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.6 }}>
                      {tip}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Paper>
          </Box>

          {/* Нижний блок */}
          <Alert
            severity="info"
            icon={<LightbulbIcon />}
            sx={{
              mb: 3,
              borderRadius: 3,
              bgcolor: PRIMARY_BG,
              color: PRIMARY_DARK,
              "& .MuiAlert-icon": { color: PRIMARY },
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              FloodSite — платформа мониторинга и моделирования наводнений. При возникновении вопросов обратитесь к разделу «Информация» или свяжитесь с администратором.
            </Typography>
          </Alert>
        </Box>
      </Box>
    </PageContainer>
  );
}
