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

    // 1. Создаем данные в формате x-www-form-urlencoded
    const formData = new URLSearchParams();
    formData.append('username', currentForm.username);
    formData.append('password', currentForm.password);

    try {
      const res = await fetch(`/auth/login`, {
        method: "POST",
        // 2. Убираем заголовок "Content-Type", браузер подставит правильный
        headers: {},
        // 3. Отправляем объект formData
        body: formData,
      });

      if (!res.ok) {
        // Пробуем получить JSON с ошибкой от FastAPI
        try {
          const errorData = await res.json();
          throw new Error(errorData.detail || t("login.error"));
        } catch {
          // Если ответ не JSON, используем общий текст
          throw new Error(t("login.error"));
        }
      }

      const data = await res.json();
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("username", currentForm.username);
      
      // Сохраняем rememberMe, если нужно
      if (currentForm.rememberMe) {
        localStorage.setItem("rememberMe", "true");
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
          backgroundColor: "#F5F5F5",
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
          backgroundColor: "#FFFFFF",
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
                background: "linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)",
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
                color: "#1F2937",
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
                color: "#111827",
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
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "12px",
                  backgroundColor: "#F9FAFB",
                  "& fieldset": {
                    borderColor: "#E5E7EB",
                  },
                  "&:hover fieldset": {
                    borderColor: "#6366F1",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#6366F1",
                  },
                },
              }}
            />
            <TextField
              fullWidth
              label={t("login.password")}
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              variant="outlined"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "12px",
                  backgroundColor: "#F9FAFB",
                  "& fieldset": {
                    borderColor: "#E5E7EB",
                  },
                  "&:hover fieldset": {
                    borderColor: "#6366F1",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#6366F1",
                  },
                },
              }}
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
                    sx={{
                      color: "#6366F1",
                      "&.Mui-checked": {
                        color: "#6366F1",
                      },
                    }}
                  />
                }
                label={
                  <Typography sx={{ color: "#4B5563", fontSize: "0.875rem" }}>
                    {t("login.rememberMe")}
                  </Typography>
                }
              />
              <MuiLink
                component={Link}
                to="/forgot-password"
                sx={{
                  color: "#6366F1",
                  textDecoration: "none",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  "&:hover": {
                    textDecoration: "underline",
                  },
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
              sx={{
                backgroundColor: "#6366F1",
                color: "white",
                padding: "12px",
                borderRadius: "12px",
                textTransform: "none",
                fontSize: "1rem",
                fontWeight: 600,
                boxShadow: "0 4px 14px 0 rgba(99, 102, 241, 0.39)",
                "&:hover": {
                  backgroundColor: "#4F46E5",
                  boxShadow: "0 6px 20px 0 rgba(99, 102, 241, 0.5)",
                },
              }}
            >
              {t("login.submit")}
            </Button>

            {/* Сообщение об ошибке */}
            {message && (
              <Typography
                sx={{
                  mt: 1,
                  color: "#EF4444",
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
                  color: "#6B7280",
                  fontSize: "0.875rem",
                }}
              >
                {t("login.noAccount")}{" "}
                <MuiLink
                  component={Link}
                  to="/register"
                  sx={{
                    color: "#6366F1",
                    textDecoration: "none",
                    fontWeight: 600,
                    "&:hover": {
                      textDecoration: "underline",
                    },
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
