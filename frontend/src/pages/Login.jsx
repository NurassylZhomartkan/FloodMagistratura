// frontend/src/pages/Login.jsx
import React, { useState } from "react";
import { Box, Paper, Typography, TextField, Button } from "@mui/material";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import backgroundImage from "../assets/floodsiteBackground.jpg";

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: "", password: "" });
  const [message, setMessage] = useState("");

  const handleChange = (e) => {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  /**
   * ИСПРАВЛЕННАЯ ФУНКЦИЯ
   * Отправляет данные в формате application/x-www-form-urlencoded
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    // 1. Создаем данные в формате x-www-form-urlencoded
    const formData = new URLSearchParams();
    formData.append('username', form.username);
    formData.append('password', form.password);

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
      localStorage.setItem("username", form.username);
      navigate("/app");

    } catch (err) {
      console.error(err);
      // Устанавливаем сообщение об ошибке, полученное от сервера
      setMessage(err.message);
    }
  };

  return (
    <Box
      sx={{
        height: "100vh",
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: "cover",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Paper sx={{ p: 4, maxWidth: 400, width: "100%" }} elevation={3}>
        <Typography variant="h5" gutterBottom>
          {t("login.title")}
        </Typography>

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label={t("login.username")}
            name="username"
            value={form.username}
            onChange={handleChange}
            margin="normal"
          />
          <TextField
            fullWidth
            label={t("login.password")}
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            margin="normal"
          />

          <Box sx={{ mt: 2, display: "flex", justifyContent: "space-between" }}>
            <Button variant="contained" type="submit">
              {t("login.submit")}
            </Button>
            <Button component={Link} to="/register" variant="outlined">
              {t("login.registerLink")}
            </Button>
          </Box>
        </form>

        {message && (
          <Typography sx={{ mt: 2 }} color="error">
            {message}
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
