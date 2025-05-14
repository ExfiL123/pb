// Функция для отображения топа игроков
function showTopPlayers() {
    // Загружаем HTML-файл с модальным окном
    fetch("/public/top-players.html")
        .then((response) => response.text())
        .then((html) => {
            // Создаем временный элемент для парсинга HTML
            const tempDiv = document.createElement("div")
            tempDiv.innerHTML = html

            // Извлекаем модальное окно
            const modal = tempDiv.querySelector("#top-players-modal")

            // Добавляем модальное окно на страницу
            document.body.appendChild(modal)

            // Загружаем данные о топе игроков
            loadTopPlayers("pixels_placed")
        })
        .catch((error) => {
            console.error("Ошибка при загрузке модального окна:", error)

            // Если не удалось загрузить HTML-файл, создаем модальное окно динамически
            createTopPlayersModal()
        })
}

// Функция для создания модального окна динамически (запасной вариант)
function createTopPlayersModal() {
    // Создаем модальное окно
    const modal = document.createElement("div")
    modal.className = "modal"
    modal.id = "top-players-modal"

    // Создаем заголовок и кнопку закрытия
    const header = document.createElement("div")
    header.className = "modal-header"

    const title = document.createElement("h2")
    title.textContent = "Топ игроков"

    const closeButton = document.createElement("button")
    closeButton.className = "close-button"
    closeButton.innerHTML = "&times;"
    closeButton.onclick = () => {
        document.body.removeChild(modal)
    }

    header.appendChild(title)
    header.appendChild(closeButton)

    // Создаем табы для сортировки
    const tabs = document.createElement("div")
    tabs.className = "tabs"

    const pixelsTab = document.createElement("button")
    pixelsTab.className = "tab active"
    pixelsTab.textContent = "По пикселям"
    pixelsTab.onclick = () => {
        pixelsTab.classList.add("active")
        timeTab.classList.remove("active")
        loadTopPlayers("pixels_placed")
    }

    const timeTab = document.createElement("button")
    timeTab.className = "tab"
    timeTab.textContent = "По времени"
    timeTab.onclick = () => {
        timeTab.classList.add("active")
        pixelsTab.classList.remove("active")
        loadTopPlayers("total_time")
    }

    tabs.appendChild(pixelsTab)
    tabs.appendChild(timeTab)

    // Создаем контейнер для таблицы
    const tableContainer = document.createElement("div")
    tableContainer.className = "table-container"

    // Создаем таблицу
    const table = document.createElement("table")
    table.className = "players-table"

    // Создаем заголовок таблицы
    const thead = document.createElement("thead")
    const headerRow = document.createElement("tr")

    const nicknameHeader = document.createElement("th")
    nicknameHeader.textContent = "Ник"

    const timeHeader = document.createElement("th")
    timeHeader.textContent = "Время проведенное в игре"

    const pixelsHeader = document.createElement("th")
    pixelsHeader.textContent = "Количество установленных пикселей"

    headerRow.appendChild(nicknameHeader)
    headerRow.appendChild(timeHeader)
    headerRow.appendChild(pixelsHeader)
    thead.appendChild(headerRow)

    // Создаем тело таблицы
    const tbody = document.createElement("tbody")
    tbody.id = "players-list"

    table.appendChild(thead)
    table.appendChild(tbody)

    tableContainer.appendChild(table)

    // Собираем модальное окно
    modal.appendChild(header)
    modal.appendChild(tabs)
    modal.appendChild(tableContainer)

    // Добавляем стили
    const style = document.createElement("style")
    style.textContent = `
          .modal {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background-color: #1a1a2e;
              border-radius: 8px;
              padding: 20px;
              z-index: 1000;
              width: 80%;
              max-width: 800px;
              max-height: 80vh;
              overflow-y: auto;
              color: white;
              box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
          }
          
          .modal-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 20px;
          }
          
          .modal-header h2 {
              margin: 0;
              color: white;
          }
          
          .close-button {
              background: none;
              border: none;
              font-size: 24px;
              cursor: pointer;
              color: white;
          }
          
          .tabs {
              display: flex;
              margin-bottom: 20px;
          }
          
          .tab {
              padding: 10px 20px;
              background-color: #2d2d42;
              border: none;
              border-radius: 4px;
              margin-right: 10px;
              cursor: pointer;
              color: white;
          }
          
          .tab.active {
              background-color: #6c63ff;
          }
          
          .table-container {
              overflow-x: auto;
          }
          
          .players-table {
              width: 100%;
              border-collapse: collapse;
          }
          
          .players-table th, .players-table td {
              padding: 12px;
              text-align: left;
              border-bottom: 1px solid #2d2d42;
          }
          
          .players-table th {
              background-color: #2d2d42;
              color: white;
          }
          
          .players-table tr:nth-child(even) {
              background-color: #1f1f35;
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

    // Добавляем модальное окно на страницу
    document.body.appendChild(modal)

    // Загружаем данные о топе игроков
    loadTopPlayers("pixels_placed")
}

// Функция для загрузки топа игроков
async function loadTopPlayers(sortBy) {
    try {
        const response = await fetch(`/api/top-players.php?sortBy=${sortBy}`)
        const data = await response.json()

        if (!data.players) {
            console.error("Ошибка получения данных о топе игроков")
            return
        }

        const playersList = document.getElementById("players-list")
        playersList.innerHTML = ""

        data.players.forEach((player) => {
            const row = document.createElement("tr")

            // Определяем роль и класс для цвета
            let roleClass = ""
            let displayName = player.username

            if (player.is_super_admin) {
                roleClass = "superadmin"
                displayName = `<span class="${roleClass}">${player.username}<br>Super admin</span>`
            } else if (player.is_admin) {
                roleClass = "admin"
                displayName = `<span class="${roleClass}">${player.username}<br>Admin</span>`
            } else if (player.is_premium) {
                roleClass = "premium"
                displayName = `<span class="${roleClass}">${player.username}<br>Premium</span>`
            }

            // Ячейка с никнеймом
            const nicknameCell = document.createElement("td")
            nicknameCell.innerHTML = displayName

            // Ячейка с временем
            const timeCell = document.createElement("td")
            if (player.total_seconds !== undefined) {
                const minutes = Math.floor(player.total_seconds / 60)
                const seconds = player.total_seconds % 60
                timeCell.textContent = `${minutes} мин ${seconds} сек`
            } else {
                timeCell.textContent = `${player.total_time} минут`
            }

            // Ячейка с количеством пикселей
            const pixelsCell = document.createElement("td")
            pixelsCell.textContent = player.pixels_placed

            row.appendChild(nicknameCell)
            row.appendChild(timeCell)
            row.appendChild(pixelsCell)
            playersList.appendChild(row)
        })
    } catch (error) {
        console.error("Ошибка при загрузке топа игроков:", error)
    }
}

// Добавляем функцию в глобальный объект window
window.showTopPlayers = showTopPlayers
  