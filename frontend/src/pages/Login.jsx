// frontend/src/pages/Login.jsx
import React, { useState, useCallback, useRef, useEffect } from "react";
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Checkbox, 
  FormControlLabel,
  Link as MuiLink
} from "@mui/material";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import AuthIllustration from "../components/AuthIllustration";
import LanguageSelectModal from "../components/LanguageSelectModal";
import { hasLanguageBeenSelected } from "../utils/languageUtils";
import { usePageTitle } from "../utils/usePageTitle";

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  usePageTitle('pageTitles.login');

  const [form, setForm] = useState({ username: "", password: "", rememberMe: false });
  const [message, setMessage] = useState("");
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const formRef = useRef(form);

  // Обновляем ref при изменении формы
  useEffect(() => {
    formRef.current = form;
  }, [form]);

  // Проверяем, был ли выбран язык при первой загрузке страницы
  useEffect(() => {
    if (!hasLanguageBeenSelected()) {
      setShowLanguageModal(true);
    }
  }, []);

  const handleLanguageModalClose = () => {
    setShowLanguageModal(false);
  };

  const handleChange = useCallback((e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [e.target.name]: value }));
  }, []);

  /**
   * ИСПРАВЛЕННАЯ ФУНКЦИЯ
   * Отправляет данные в формате application/x-www-form-urlencoded
   */
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setMessage("");

    const currentForm = formRef.current;

    const formData = new URLSearchParams();
    formData.append('username', currentForm.username);
    formData.append('password', currentForm.password);
    formData.append('remember_me', currentForm.rememberMe ? 'true' : 'false');

    try {
      const res = await fetch(`/auth/login`, {
        method: "POST",
        headers: {},
        body: formData,
      });

      if (!res.ok) {
        try {
          const errorData = await res.json();
          throw new Error(errorData.detail || t("login.error"));
        } catch {
          throw new Error(t("login.error"));
        }
      }

      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("username", currentForm.username);
      
      if (currentForm.rememberMe) {
        localStorage.setItem("rememberMe", "true");
      } else {
        localStorage.removeItem("rememberMe");
      }
      
      // Перенаправляем на сохраненный URL или на главную страницу
      const redirectPath = sessionStorage.getItem('redirectAfterLogin') || "/app";
      sessionStorage.removeItem('redirectAfterLogin');
      navigate(redirectPath);

    } catch (err) {
      console.error(err);
      // Устанавливаем сообщение об ошибке, полученное от сервера
      setMessage(err.message);
    }
  }, [t, navigate]);

  return (
    <>
      <LanguageSelectModal open={showLanguageModal} onClose={handleLanguageModalClose} />
      <Box
        sx={{
          height: "100vh",
          display: "flex",
          bgcolor: "background.default",
        }}
      >
      {/* Левая часть - форма */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 4,
          bgcolor: "background.paper",
        }}
      >
        <Box
          sx={{
            width: "100%",
            maxWidth: 420,
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          {/* Логотип/Название */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.light} 100%)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontWeight: "bold",
                fontSize: "1.2rem",
              }}
            >
              F
            </Box>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 700,
                color: "text.primary",
                letterSpacing: "-0.5px",
              }}
            >
              FloodSite
            </Typography>
          </Box>

          {/* Приветственное сообщение */}
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: "text.primary",
                mb: 1,
              }}
            >
              {t("login.welcome")}
            </Typography>
          </Box>

          {/* Форма */}
          <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              fullWidth
              label={t("login.username")}
              name="username"
              value={form.username}
              onChange={handleChange}
              variant="outlined"
            />
            <TextField
              fullWidth
              label={t("login.password")}
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              variant="outlined"
            />

            {/* Remember me и Forgot Password */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    name="rememberMe"
                    checked={form.rememberMe}
                    onChange={handleChange}
                  />
                }
                label={
                  <Typography sx={{ color: "text.secondary", fontSize: "0.875rem" }}>
                    {t("login.rememberMe")}
                  </Typography>
                }
              />
              <MuiLink
                component={Link}
                to="/forgot-password"
                sx={{
                  color: "primary.main",
                  textDecoration: "none",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                }}
              >
                {t("login.forgotPassword")}
              </MuiLink>
            </Box>

            {/* Кнопка Sign In */}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              color="primary"
              sx={{
                padding: "12px",
              }}
            >
              {t("login.submit")}
            </Button>

            {/* Сообщение об ошибке */}
            {message && (
              <Typography
                sx={{
                  mt: 1,
                  color: "error.main",
                  fontSize: "0.875rem",
                  textAlign: "center",
                }}
              >
                {message}
              </Typography>
            )}

            {/* Ссылка на регистрацию */}
            <Box sx={{ textAlign: "center", mt: 1 }}>
              <Typography
                sx={{
                  color: "text.secondary",
                  fontSize: "0.875rem",
                }}
              >
                {t("login.noAccount")}{" "}
                <MuiLink
                  component={Link}
                  to="/register"
                  sx={{
                    color: "primary.main",
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  {t("login.signUp")}
                </MuiLink>
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Правая часть - иллюстрация */}
      <Box
        sx={{
          flex: 1,
          display: { xs: "none", md: "flex" },
        }}
      >
        <AuthIllustration />
      </Box>
    </Box>
    </>
  );
}
