// // Добавляем загрузку скриптов для отображения топа игроков и информации о пользователе
// document.addEventListener("DOMContentLoaded", () => {
//     // Загружаем скрипт для отображения топа игроков
//     const topPlayersScript = document.createElement("script")
//     topPlayersScript.src = "/js/top-players.js"
//     document.head.appendChild(topPlayersScript)

//     // Загружаем скрипт для отображения информации о пользователе
//     const userInfoScript = document.createElement("script")
//     userInfoScript.src = "/js/user-info.js"
//     document.head.appendChild(userInfoScript)

//     // Загружаем данные о текущем пользователе
//     if (isLoggedIn()) {
//         loadCurrentUserData()
//     }
// })

// // Функция для проверки, авторизован ли пользователь
// function isLoggedIn() {
//     // Проверяем наличие куки или локального хранилища с информацией о сессии
//     return document.cookie.includes("PHPSESSID=") || localStorage.getItem("user_token")
// }

// // Функция для загрузки данных о текущем пользователе
// async function loadCurrentUserData() {
//     try {
//         const response = await fetch("/api/auth.php?action=get_current_user")
//         const data = await response.json()

//         if (data.user) {
//             // Сохраняем данные о пользователе в глобальной переменной
//             window.currentUser = data.user

//             // Создаем событие, сигнализирующее о загрузке данных пользователя
//             const event = new Event("userDataLoaded")
//             window.dispatchEvent(event)
//         }
//     } catch (error) {
//         console.error("Ошибка при загрузке данных о пользователе:", error)
//     }
// }
  