// Функция для отображения информации о пользователе в правом верхнем углу
async function updateUserInfo() {
    try {
        // Проверяем, авторизован ли пользователь
        if (!window.currentUser || !window.currentUser.id) {
            console.log("Пользователь не авторизован")
            return
        }

        // Получаем элемент для отображения информации о пользователе
        let userInfoElement = document.getElementById("user-info")

        // Если элемент не существует, создаем его
        if (!userInfoElement) {
            userInfoElement = document.createElement("div")
            userInfoElement.id = "user-info"
            userInfoElement.className = "user-info"

            // Добавляем элемент в правый верхний угол
            document.body.appendChild(userInfoElement)

            // Добавляем стили
            const style = document.createElement("style")
            style.textContent = `
                  .user-info {
                      position: fixed;
                      top: 10px;
                      right: 10px;
                      background-color: rgba(26, 26, 46, 0.8);
                      padding: 10px;
                      border-radius: 4px;
                      color: white;
                      z-index: 100;
                      display: flex;
                      align-items: center;
                  }
                  
                  .user-avatar {
                      width: 32px;
                      height: 32px;
                      border-radius: 50%;
                      margin-right: 10px;
                      background-color: #2d2d42;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      font-weight: bold;
                  }
                  
                  .user-details {
                      display: flex;
                      flex-direction: column;
                  }
                  
                  .user-name {
                      font-weight: bold;
                      margin-bottom: 2px;
                  }
                  
                  .superadmin {
                      color: red;
                  }
                  
                  .admin {
                      color: blue;
                  }
                  
                  .premium {
                      color: orange;
                  }
              `

            document.head.appendChild(style)
        }

        // Определяем роль пользователя и класс для цвета
        let roleClass = ""
        let roleText = ""

        if (window.currentUser.is_super_admin) {
            roleClass = "superadmin"
            roleText = "Super admin"
        } else if (window.currentUser.is_admin) {
            roleClass = "admin"
            roleText = "Admin"
        } else if (window.currentUser.is_premium) {
            roleClass = "premium"
            roleText = "Premium"
        }

        // Создаем содержимое элемента
        userInfoElement.innerHTML = `
              <div class="user-avatar">${window.currentUser.username.charAt(0).toUpperCase()}</div>
              <div class="user-details">
                  <span class="${roleClass}">${window.currentUser.username}${roleText ? "<br>" + roleText : ""}</span>
              </div>
          `
    } catch (error) {
        console.error("Ошибка при обновлении информации о пользователе:", error)
    }
}

// Добавляем функцию в глобальный объект window
window.updateUserInfo = updateUserInfo

// Вызываем функцию при загрузке страницы
document.addEventListener("DOMContentLoaded", () => {
    // Проверяем, загружены ли данные о пользователе
    if (window.currentUser) {
        updateUserInfo()
    } else {
        // Если данные о пользователе еще не загружены, ждем их
        window.addEventListener("userDataLoaded", updateUserInfo)
    }
})
  