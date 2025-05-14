document.addEventListener("DOMContentLoaded", () => {
    // Canvas setup
    const canvas = document.getElementById("pixel-canvas")
    const ctx = canvas.getContext("2d")
    const canvasWrapper = document.getElementById("canvas-wrapper")
    const canvasStatus = document.getElementById("canvas-status")
    const currentTimeDisplay = document.getElementById("current-time")

    // Canvas settings
    // Обновленные размеры холста
    const CANVAS_WIDTH = 4200
    const CANVAS_HEIGHT = 2400
    const PIXEL_SIZE = 7
    const GRID_COLOR = "#2a2a40"

    // Устанавливаем размеры холста
    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT

    // View state
    let scale = 1
    let offsetX = 0
    let offsetY = 0
    let isDragging = false
    let lastX, lastY
    let isMoveMode = false // Режим перемещения

    // Pixel data
    let pixelData = {}

    // Auth state
    let currentUser = null
    let isUserAdmin = false
    let isUserSuperAdmin = false
    let isUserPremium = false
    let isUserBlocked = false

    // Drawing time restrictions (Moscow time)
    const DRAWING_START_HOUR = 6 // 06:00
    const DRAWING_END_HOUR = 23
    const DRAWING_END_MINUTE = 59 // 23:59

    // Coin system variables
    let userCoins = 0
    let userPixelsPlaced = 0
    let userTotalTime = 0
    let userTotalSeconds = 0
    let sessionStartTime = Date.now()
    let sessionStartSeconds = Math.floor(Date.now() / 1000)
    const timeRewards = {
        5: 2, // 5 минут: +2 коина
        10: 3, // 10 минут: +3 коина
        15: 3, // 15 минут: +3 коина
        30: 5, // 30 минут: +5 коинов
    }
    const pixelRewards = {
        15: 1, // 15 пикселей: +1 коин
        30: 1, // 30 пикселей: +1 коин
        50: 2, // 50 пикселей: +2 коина
        75: 3, // 75 пикселей: +3 коин
        100: 5, // 100 пикселей: +5 коинов
    }
    let rewardedTimeThresholds = []
    const rewardedPixelThresholds = []
    let isBombActive = false
    let correctCaptchaAnswer = 0

    // Pagination variables
    let currentPage = 1
    const usersPerPage = 24
    let totalUsers = 0

    const activityMap = new Map(); 
    const bannedUsers = new Set();

    document.addEventListener("DOMContentLoaded", () => {
        // Загружаем скрипт для отображения топа игроков
        const topPlayersScript = document.createElement("script")
        topPlayersScript.src = "/js/top-players.js"
        document.head.appendChild(topPlayersScript)

        // Загружаем скрипт для отображения информации о пользователе
        const userInfoScript = document.createElement("script")
        userInfoScript.src = "/js/user-info.js"
        document.head.appendChild(userInfoScript)

        // Загружаем данные о текущем пользователе
        if (isLoggedIn()) {
            loadCurrentUserData()
        }
    })

    // Функция для проверки, авторизован ли пользователь
    function isLoggedIn() {
        // Проверяем наличие куки или локального хранилища с информацией о сессии
        return document.cookie.includes("PHPSESSID=") || localStorage.getItem("user_token")
    }

    // Функция для загрузки данных о текущем пользователе
    async function loadCurrentUserData() {
        try {
            const response = await fetch("/api/auth.php?action=get_current_user")
            const data = await response.json()

            if (data.user) {
                // Сохраняем данные о пользователе в глобальной переменной
                window.currentUser = data.user

                // Создаем событие, сигнализирующее о загрузке данных пользователя
                const event = new Event("userDataLoaded")
                window.dispatchEvent(event)
            }
        } catch (error) {
            console.error("Ошибка при загрузке данных о пользователе:", error)
        }
      }

    function isBanned(userId) {
        return bannedUsers.has(userId);
    }

    function trackActivity(userId) {
        const now = Date.now();
        const window = 30_000; 

        if (!activityMap.has(userId)) {
            activityMap.set(userId, []);
        }

        const timestamps = activityMap.get(userId);
        while (timestamps.length && now - timestamps[0] > window) {
            timestamps.shift();
        }

        timestamps.push(now);
        if (timestamps.length >= 28) {
            bannedUsers.add(userId);
            console.log(`❌ User ${userId} забанен за использование бота.`);
            return false;
        }

        activityMap.set(userId, timestamps);
        return true;
    }

    // DOM elements
    const colorPicker = document.getElementById("color-picker")
    const zoomInBtn = document.getElementById("zoom-in")
    const zoomOutBtn = document.getElementById("zoom-out")
    const resetViewBtn = document.getElementById("reset-view")

    const loggedOutContainer = document.getElementById("logged-out")
    const loggedInContainer = document.getElementById("logged-in")
    const usernameDisplay = document.getElementById("username-display")
    const userAvatar = document.getElementById("user-avatar")
    const adminPanelBtn = document.getElementById("admin-panel-btn")

    const loginBtn = document.getElementById("login-btn")
    const registerBtn = document.getElementById("register-btn")
    const logoutBtn = document.getElementById("logout-btn")

    const loginModal = document.getElementById("login-modal")
    const registerModal = document.getElementById("register-modal")
    const adminModal = document.getElementById("admin-modal")

    const loginForm = document.getElementById("login-form")
    const registerForm = document.getElementById("register-form")
    const clearPixelsForm = document.getElementById("clear-pixels-form")

    const loginError = document.getElementById("login-error")
    const registerError = document.getElementById("register-error")
    const clearError = document.getElementById("clear-error")
    const usersError = document.getElementById("users-error")

    const showLoginLink = document.getElementById("show-login")
    const showRegisterLink = document.getElementById("show-register")

    const usernameInput = document.getElementById("register-username")
    const usernameStatus = document.getElementById("username-status")
    const passwordInput = document.getElementById("register-password")
    const confirmPasswordInput = document.getElementById("register-confirm-password")

    const closeBtns = document.querySelectorAll(".close")
    const tabBtns = document.querySelectorAll(".tab-btn")

    // Add these variables after the existing DOM elements
    const eraserBtn = document.getElementById("eraser-btn")
    const canvasLockToggle = document.getElementById("canvas-lock")
    const saveSettingsBtn = document.getElementById("save-settings")
    const settingsError = document.getElementById("settings-error")
    const settingsSuccess = document.getElementById("settings-success")

    // Shop and profile elements
    const shopBtn = document.getElementById("shop-btn")
    const coinsDisplay = document.getElementById("coins-display")
    const shopModal = document.getElementById("shop-modal")
    const buyBombBtn = document.getElementById("buy-bomb-btn")
    const buyPremiumBtn = document.getElementById("buy-premium-btn") // Добавлена кнопка покупки премиума
    const shopError = document.getElementById("shop-error")
    const profileModal = document.getElementById("profile-modal")
    const totalTimeDisplay = document.getElementById("total-time")
    const totalPixelsDisplay = document.getElementById("total-pixels")
    const totalCoinsDisplay = document.getElementById("total-coins")
    const updatesBtn = document.getElementById("updates-btn")
    const updatesModal = document.getElementById("updates-modal")

    // Top players elements
    const topPlayersBtn = document.getElementById("top-players-btn")
    const topPlayersModal = document.getElementById("top-players-modal")
    const sortByPixelsBtn = document.getElementById("sort-by-pixels")
    const sortByTimeBtn = document.getElementById("sort-by-time")
    const topPlayersList = document.getElementById("top-players-list")

    // Admin management elements
    const adminManagementTabBtn = document.getElementById("admin-management-tab-btn")
    const adminSearchBtn = document.getElementById("admin-search-btn")
    const adminSearchInput = document.getElementById("admin-search")
    const adminSearchResults = document.getElementById("admin-search-results")
    const adminManagementError = document.getElementById("admin-management-error")
    const adminManagementSuccess = document.getElementById("admin-management-success")

    // Add a cooldown indicator element to the body
    const cooldownIndicator = document.createElement("div")
    cooldownIndicator.className = "cooldown-indicator"
    cooldownIndicator.textContent = "Подождите..."
    document.body.appendChild(cooldownIndicator)

    // Add these variables after the existing state variables
    let isEraserActive = false
    let isCanvasLocked = false
    let cooldownTimer = null
    let lastPixelTime = 0

    // Добавить минимальный масштаб, чтобы холст всегда заполнял видимую область
    // Коэффициент для возможности отдаления чуть больше стандартного (0.8 = на 20% меньше)
    const ZOOM_OUT_FACTOR = 0.8
    let minScale = 1

    // Создаем элементы навигации и кнопку режима перемещения
    createNavigationControls()

    // Создаем индикатор координат
    const coordsIndicator = document.createElement("div")
    coordsIndicator.className = "coords-indicator"
    coordsIndicator.textContent = "X: 0, Y: 0"
    document.body.appendChild(coordsIndicator)

    // Functions for API interaction
    async function register(username, password) {
        try {
            const response = await fetch("api/auth.php?action=register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, password }),
            })

            const data = await response.json()

            if (data.error) {
                return { error: { message: data.error } }
            }

            return { user: data.user, error: null }
        } catch (error) {
            console.error("Unexpected error during registration:", error)
            return { error: { message: error.message } }
        }
    }

    async function login(username, password) {
        try {
            const response = await fetch("api/auth.php?action=login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username, password }),
            })

            const data = await response.json()

            if (data.error) {
                return { error: { message: data.error } }
            }

            return { user: data.user, error: null }
        } catch (error) {
            console.error("Unexpected error during login:", error)
            return { error: { message: error.message } }
        }
    }

    async function checkUsername(username) {
        try {
            const response = await fetch("api/auth.php?action=check_username", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username }),
            })

            const data = await response.json()

            if (data.error) {
                return { available: false, error: data.error }
            }

            return { available: data.available, error: null }
        } catch (error) {
            console.error("Error checking username:", error)
            return { available: false, error: error.message }
        }
    }

    async function signOut() {
        try {
            const response = await fetch("api/auth.php?action=logout", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
            })

            const data = await response.json()

            if (data.success) {
                handleSignOut()
                // Перезагружаем страницу после выхода
                window.location.reload()
            }
        } catch (error) {
            console.error("Error signing out:", error)
        }
    }

    async function getCanvas() {
        try {
            const response = await fetch("api/canvas.php?action=get")
            const data = await response.json()

            if (data.error) {
                console.error("Error getting canvas:", data.error)
                return { pixels: [], error: data.error }
            }

            return { pixels: data.pixels, error: null }
        } catch (error) {
            console.error("Unexpected error getting canvas:", error)
            return { pixels: [], error: error.message }
        }
    }

    async function placePixel(x, y, color) {
        try {
            const response = await fetch("api/canvas.php?action=place", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ x, y, color }),
            })

            const data = await response.json()

            if (data.error) {
                console.error("Error placing pixel:", data.error)
                return { error: { message: data.error } }
            }

            return { error: null }
        } catch (error) {
            console.error("Unexpected error placing pixel:", error)
            return { error: { message: error.message } }
        }
    }

    async function clearPixels(startX, startY, endX, endY) {
        try {
            const response = await fetch("api/canvas.php?action=clear", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ startX, startY, endX, endY }),
            })

            const data = await response.json()

            if (data.error) {
                console.error("Error clearing pixels:", data.error)
                return { error: { message: data.error } }
            }

            return { error: null }
        } catch (error) {
            console.error("Unexpected error clearing pixels:", error)
            return { error: { message: error.message } }
        }
    }

    async function getUsers(page = 1) {
        try {
            const response = await fetch(`api/users.php?action=get&page=${page}&limit=${usersPerPage}`)
            const data = await response.json()

            if (data.error) {
                console.error("Error getting users:", data.error)
                return { users: [], totalUsers: 0, error: { message: data.error } }
            }

            return {
                users: data.users,
                totalUsers: data.totalUsers,
                error: null,
            }
        } catch (error) {
            console.error("Unexpected error getting users:", error)
            return { users: [], totalUsers: 0, error: error.message }
        }
    }

    async function blockUser(userId) {
        try {
            const response = await fetch("api/users.php?action=block", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ userId }),
            })

            const data = await response.json()

            if (data.error) {
                console.error("Error blocking user:", data.error)
                return { error: { message: data.error } }
            }

            return { error: null }
        } catch (error) {
            console.error("Unexpected error blocking user:", error)
            return { error: { message: error.message } }
        }
    }

    async function unblockUser(userId) {
        try {
            const response = await fetch("api/users.php?action=unblock", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ userId }),
            })

            const data = await response.json()

            if (data.error) {
                console.error("Error unblocking user:", data.error)
                return { error: { message: data.error } }
            }

            return { error: null }
        } catch (error) {
            console.error("Unexpected error unblocking user:", error)
            return { error: { message: error.message } }
        }
    }

    async function erasePixel(x, y) {
        try {
            const response = await fetch("api/canvas.php?action=erase", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ x, y }),
            })

            const data = await response.json()

            if (data.error) {
                console.error("Error erasing pixel:", data.error)
                return { error: { message: data.error } }
            }

            return { error: null }
        } catch (error) {
            console.error("Unexpected error erasing pixel:", error)
            return { error: { message: error.message } }
        }
    }

    async function getCanvasSettings() {
        try {
            const response = await fetch("api/canvas.php?action=get_settings")
            const data = await response.json()

            if (data.error) {
                console.error("Error getting canvas settings:", data.error)
                return { settings: null, error: data.error }
            }

            return { settings: data.settings, error: null }
        } catch (error) {
            console.error("Unexpected error getting canvas settings:", error)
            return { settings: null, error: error.message }
        }
    }

    async function updateCanvasSettings(settings) {
        try {
            const response = await fetch("api/canvas.php?action=update_settings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(settings),
            })

            const data = await response.json()

            if (data.error) {
                console.error("Error updating canvas settings:", data.error)
                return { error: { message: data.error } }
            }

            return { error: null }
        } catch (error) {
            console.error("Unexpected error updating canvas settings:", error)
            return { error: { message: error.message } }
        }
    }

    // User stats and shop API functions
    async function getUserStats() {
        try {
            const response = await fetch("api/user.php?action=get_stats")
            const data = await response.json()

            if (data.error) {
                console.error("Error getting user stats:", data.error)
                return { stats: null, error: data.error }
            }

            return { stats: data.stats, error: null }
        } catch (error) {
            console.error("Unexpected error getting user stats:", error)
            return { stats: null, error: error.message }
        }
    }

    async function updateUserStats(stats) {
        try {
            const response = await fetch("api/user.php?action=update_stats", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(stats),
            })

            const data = await response.json()

            if (data.error) {
                console.error("Error updating user stats:", data.error)
                return { error: { message: data.error } }
            }

            return { error: null }
        } catch (error) {
            console.error("Unexpected error updating user stats:", error)
            return { error: { message: error.message } }
        }
    }

    async function buyItem(itemId) {
        try {
            const response = await fetch("api/shop.php?action=buy", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ itemId }),
            })

            const data = await response.json()

            if (data.error) {
                console.error("Error buying item:", data.error)
                return { success: false, error: data.error }
            }

            return { success: true, error: null }
        } catch (error) {
            console.error("Unexpected error buying item:", error)
            return { success: false, error: error.message }
        }
    }

    // Admin management functions
    async function searchUsers(query) {
        try {
            const response = await fetch("api/users.php?action=search", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ query }),
            })

            const data = await response.json()

            if (data.error) {
                console.error("Error searching users:", data.error)
                return { users: [], error: data.error }
            }

            return { users: data.users, error: null }
        } catch (error) {
            console.error("Unexpected error searching users:", error)
            return { users: [], error: error.message }
        }
    }

    async function addAdmin(username) {
        try {
            const response = await fetch("api/auth.php?action=add_admin", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username }),
            })

            const data = await response.json()

            if (data.error) {
                console.error("Error adding admin:", data.error)
                return { success: false, error: data.error }
            }

            return { success: true, error: null }
        } catch (error) {
            console.error("Unexpected error adding admin:", error)
            return { success: false, error: error.message }
        }
    }

    async function removeAdmin(username) {
        try {
            const response = await fetch("api/auth.php?action=remove_admin", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ username }),
            })

            const data = await response.json()

            if (data.error) {
                console.error("Error removing admin:", data.error)
                return { success: false, error: data.error }
            }

            return { success: true, error: null }
        } catch (error) {
            console.error("Unexpected error removing admin:", error)
            return { success: false, error: error.message }
        }
    }

    // Top players functions
    async function getTopPlayers(sortBy = "pixels_placed") {
        try {
            const response = await fetch("api/users.php?action=get_top_players", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ sortBy }),
            })

            const data = await response.json()

            if (data.error) {
                console.error("Error getting top players:", data.error)
                return { players: [], error: data.error }
            }

            return { players: data.players, error: null }
        } catch (error) {
            console.error("Unexpected error getting top players:", error)
            return { players: [], error: error.message }
        }
    }

    // Initialize the application
    async function init() {
        // Check if user is already logged in
        try {
            const response = await fetch("api/auth.php?action=check")
            const data = await response.json()

            if (data.user) {
                await handleAuthStateChange(data.user)
            }
        } catch (error) {
            console.error("Error checking authentication:", error)
        }

        // Load canvas settings
        try {
            const { settings, error } = await getCanvasSettings()
            if (!error && settings) {
                isCanvasLocked = settings.is_locked === 1
                if (canvasLockToggle) {
                    canvasLockToggle.checked = isCanvasLocked
                }
            }
        } catch (error) {
            console.error("Error loading canvas settings:", error)
        }

        // Load initial canvas data
        await loadCanvas()

        // Draw the initial canvas
        drawCanvas()

        // Set up event listeners
        setupEventListeners()

        // Start time display updates
        updateTimeDisplay()
        setInterval(updateTimeDisplay, 1000)

        // Check drawing availability
        checkDrawingAvailability()

        // Resize canvas to fit container
        resizeCanvas()

        // Центрируем холст
        centerCanvas()
    }

    // Функция для создания элементов навигации
    function createNavigationControls() {
        // Создаем контейнер для кнопок навигации
        const navContainer = document.createElement("div")
        navContainer.className = "navigation-controls"

        // Создаем кнопки для перемещения
        const upBtn = document.createElement("button")
        upBtn.innerHTML = '<i class="fas fa-arrow-up"></i>'
        upBtn.className = "nav-btn up-btn"
        upBtn.title = "Переместиться вверх"

        const downBtn = document.createElement("button")
        downBtn.innerHTML = '<i class="fas fa-arrow-down"></i>'
        downBtn.className = "nav-btn down-btn"
        downBtn.title = "Переместиться вниз"

        const leftBtn = document.createElement("button")
        leftBtn.innerHTML = '<i class="fas fa-arrow-left"></i>'
        leftBtn.className = "nav-btn left-btn"
        leftBtn.title = "Переместиться влево"

        const rightBtn = document.createElement("button")
        rightBtn.innerHTML = '<i class="fas fa-arrow-right"></i>'
        rightBtn.className = "nav-btn right-btn"
        rightBtn.title = "Переместиться вправо"

        // Создаем кнопку режима перемещения
        const moveBtn = document.createElement("button")
        moveBtn.innerHTML = '<i class="fas fa-arrows-alt"></i>'
        moveBtn.className = "nav-btn move-btn"
        moveBtn.title = "Режим перемещения (перетаскивание мышью)"

        // Добавляем обработчики событий
        upBtn.addEventListener("click", () => moveCanvas(0, 100))
        downBtn.addEventListener("click", () => moveCanvas(0, -100))
        leftBtn.addEventListener("click", () => moveCanvas(100, 0))
        rightBtn.addEventListener("click", () => moveCanvas(-100, 0))
        moveBtn.addEventListener("click", () => {
            isMoveMode = !isMoveMode
            if (isMoveMode) {
                moveBtn.classList.add("active")
                canvas.style.cursor = "move"
                showNotification("Режим перемещения активирован. Используйте мышь для перемещения холста.")
            } else {
                moveBtn.classList.remove("active")
                canvas.style.cursor = isDrawingAllowed() ? "crosshair" : "not-allowed"
                showNotification("Режим перемещения деактивирован.")
            }
        })

        // Добавляем кнопки в контейнер
        navContainer.appendChild(upBtn)
        navContainer.appendChild(leftBtn)
        navContainer.appendChild(moveBtn) // Добавляем кнопку режима перемещения в центр
        navContainer.appendChild(downBtn)
        navContainer.appendChild(rightBtn)

        // Добавляем контейнер на страницу
        document.body.appendChild(navContainer)

        // Добавляем обработчики клавиш для навигации
        document.addEventListener("keydown", (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
                return // Не обрабатываем нажатия клавиш, если фокус в поле ввода
            }

            // Перемещение с помощью клавиш со стрелками
            switch (e.key) {
                case "ArrowUp":
                    e.preventDefault()
                    moveCanvas(0, 50)
                    break
                case "ArrowDown":
                    e.preventDefault()
                    moveCanvas(0, -50)
                    break
                case "ArrowLeft":
                    e.preventDefault()
                    moveCanvas(50, 0)
                    break
                case "ArrowRight":
                    e.preventDefault()
                    moveCanvas(-50, 0)
                    break
            }
        })
    }

    // Функция для перемещения холста с ограничениями
    function moveCanvas(dx, dy) {
        // Рассчитываем новые значения смещения
        const newOffsetX = offsetX + dx
        const newOffsetY = offsetY + dy

        // Получаем размеры контейнера
        const containerWidth = canvasWrapper.clientWidth
        const containerHeight = canvasWrapper.clientHeight

        // Рассчитываем границы для смещения
        const minOffsetX = containerWidth - CANVAS_WIDTH * scale
        const minOffsetY = containerHeight - CANVAS_HEIGHT * scale

        // Применяем ограничения
        offsetX = Math.min(0, Math.max(minOffsetX, newOffsetX))
        offsetY = Math.min(0, Math.max(minOffsetY, newOffsetY))

        drawCanvas()
    }

    // Функция для центрирования холста
    function centerCanvas() {
        const containerWidth = canvasWrapper.clientWidth
        const containerHeight = canvasWrapper.clientHeight

        // Убедимся, что масштаб не меньше минимального
        if (scale < minScale) {
            scale = minScale
        }

        // Центрируем холст
        offsetX = Math.min(0, (containerWidth - CANVAS_WIDTH * scale) / 2)
        offsetY = Math.min(0, (containerHeight - CANVAS_HEIGHT * scale) / 2)

        // Если холст меньше контейнера, центрируем его
        if (CANVAS_WIDTH * scale < containerWidth) {
            offsetX = (containerWidth - CANVAS_WIDTH * scale) / 2
        }
        if (CANVAS_HEIGHT * scale < containerHeight) {
            offsetY = (containerHeight - CANVAS_HEIGHT * scale) / 2
        }

        drawCanvas()
    }

    // Функция для изменения размеров холста
    function resizeCanvas() {
        const containerWidth = canvasWrapper.clientWidth
        const containerHeight = canvasWrapper.clientHeight

        // Устанавливаем размеры canvas элемента равными размерам контейнера
        canvas.style.width = containerWidth + "px"
        canvas.style.height = containerHeight + "px"

        // Устанавливаем внутренние размеры canvas для корректного рендеринга
        canvas.width = containerWidth
        canvas.height = containerHeight

        // Рассчитываем минимальный масштаб, чтобы холст заполнял всю видимую область
        // Умножаем на ZOOM_OUT_FACTOR, чтобы можно было отдалить чуть больше
        minScale = Math.max(containerWidth / CANVAS_WIDTH, containerHeight / CANVAS_HEIGHT) * ZOOM_OUT_FACTOR

        // Если текущий масштаб меньше минимального, устанавливаем минимальный
        if (scale < minScale) {
            scale = minScale
        }

        // Применяем ограничения на смещение
        const minOffsetX = containerWidth - CANVAS_WIDTH * scale
        const minOffsetY = containerHeight - CANVAS_HEIGHT * scale

        offsetX = Math.min(0, Math.max(minOffsetX, offsetX))
        offsetY = Math.min(0, Math.max(minOffsetY, offsetY))

        drawCanvas()
    }

    // Обновление индикатора координат
    function updateCoordsIndicator(x, y) {
        coordsIndicator.textContent = `X: ${x}, Y: ${y}`
    }

    // Handle authentication state change
    async function handleAuthStateChange(user) {
        currentUser = user
        isUserAdmin = user.is_admin === 1 || user.is_admin === true
        isUserSuperAdmin = user.is_super_admin === 1 || user.is_super_admin === true
        isUserPremium = user.is_premium === 1 || user.is_premium === true
        isUserBlocked = user.is_blocked === 1 || user.is_blocked === true

        console.log("User data:", user)
        console.log("isUserAdmin:", isUserAdmin, "Type:", typeof isUserAdmin)
        console.log("isUserSuperAdmin:", isUserSuperAdmin, "Type:", typeof isUserSuperAdmin)
        console.log("isUserPremium:", isUserPremium, "Type:", typeof isUserPremium)

        // Update UI
        loggedOutContainer.classList.add("hidden")
        loggedInContainer.classList.remove("hidden")

        // Применяем стили к имени пользователя в зависимости от статуса
        if (isUserSuperAdmin) {
            // Главный администратор - красный с подсветкой
            usernameDisplay.textContent = user.username + " Super admin"
            usernameDisplay.className = "super-admin-username"
        } else if (isUserAdmin) {
            // Администратор - зеленый с подсветкой
            usernameDisplay.textContent = user.username + " Admin"
            usernameDisplay.className = "admin-username"
        } else if (isUserPremium) {
            // Премиум - оранжевый с подсветкой
            usernameDisplay.textContent = user.username
            usernameDisplay.className = "premium-username"
        } else {
            // Обычный пользователь
            usernameDisplay.textContent = user.username
            usernameDisplay.className = ""
        }

        if (user.avatar) {
            userAvatar.src = user.avatar
            userAvatar.classList.remove("hidden")
        } else {
            userAvatar.classList.add("hidden")
        }

        // Показываем кнопку админ-панели для админов
        if (isUserAdmin) {
            adminPanelBtn.classList.remove("hidden")
            console.log("Пользователь является администратором, кнопка админ-панели должна быть видна")

            // Скрываем вкладку управления админами для обычных админов
            if (!isUserSuperAdmin && adminManagementTabBtn) {
                adminManagementTabBtn.classList.add("hidden")
            } else if (adminManagementTabBtn) {
                adminManagementTabBtn.classList.remove("hidden")
            }
        } else {
            adminPanelBtn.classList.add("hidden")
            console.log("Пользователь не является администратором, is_admin =", user.is_admin)
        }

        // Показываем кнопку магазина для авторизованных пользователей
        shopBtn.classList.remove("hidden")

        // Загружаем статистику пользователя
        await loadUserStats()

        // Запускаем таймер для отслеживания времени на сайте
        sessionStartTime = Date.now()
        sessionStartSeconds = Math.floor(Date.now() / 1000)
        startTimeTracker()
    }

    // Handle sign out
    function handleSignOut() {
        currentUser = null
        isUserAdmin = false
        isUserSuperAdmin = false
        isUserPremium = false
        isUserBlocked = false

        // Update UI
        loggedOutContainer.classList.remove("hidden")
        loggedInContainer.classList.add("hidden")
        usernameDisplay.textContent = ""
        usernameDisplay.className = ""
        userAvatar.classList.add("hidden")
        adminPanelBtn.classList.add("hidden")
        shopBtn.classList.add("hidden")
    }

    // Load canvas data from the database
    async function loadCanvas() {
        const { pixels, error } = await getCanvas()

        if (error) {
            console.error("Error loading canvas:", error)
            return
        }

        // Convert array to object for faster lookups
        pixelData = {}
        pixels.forEach((pixel) => {
            const key = `${pixel.x},${pixel.y}`
            pixelData[key] = pixel.color
        })

        console.log(`Loaded ${pixels.length} pixels from database`)
    }

    // Draw the canvas
    function drawCanvas() {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Apply transformations
        ctx.save()
        ctx.translate(offsetX, offsetY)
        ctx.scale(scale, scale)

        // Draw grid
        ctx.strokeStyle = GRID_COLOR
        ctx.lineWidth = 0.5

        // Вычисляем видимую область холста
        const visibleLeft = Math.max(0, Math.floor(-offsetX / scale / PIXEL_SIZE))
        const visibleTop = Math.max(0, Math.floor(-offsetY / scale / PIXEL_SIZE))
        const visibleRight = Math.ceil((canvas.width - offsetX) / scale / PIXEL_SIZE) + 1
        const visibleBottom = Math.min(
            CANVAS_HEIGHT / PIXEL_SIZE,
            Math.ceil((canvas.height - offsetY) / scale / PIXEL_SIZE + 1),
        )

        // Рисуем только видимую часть сетки
        for (let x = visibleLeft; x <= visibleRight; x++) {
            ctx.beginPath()
            ctx.moveTo(x * PIXEL_SIZE, visibleTop * PIXEL_SIZE)
            ctx.lineTo(x * PIXEL_SIZE, visibleBottom * PIXEL_SIZE)
            ctx.stroke()
        }

        for (let y = visibleTop; y <= visibleBottom; y++) {
            ctx.beginPath()
            ctx.moveTo(visibleLeft * PIXEL_SIZE, y * PIXEL_SIZE)
            ctx.lineTo(visibleRight * PIXEL_SIZE, y * PIXEL_SIZE)
            ctx.stroke()
        }

        // Draw pixels - только видимые
        for (let x = visibleLeft; x < visibleRight; x++) {
            for (let y = visibleTop; y < visibleBottom; y++) {
                const key = `${x},${y}`
                if (pixelData[key]) {
                    ctx.fillStyle = pixelData[key]
                    ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE)
                }
            }
        }

        ctx.restore()
    }

    // Check if drawing is allowed at current time (Moscow time)
    function isDrawingAllowed() {
        // Админы всегда могут рисовать
        if (isUserAdmin) {
            return true
        }

        // Create date object with Moscow time
        const now = new Date()
        const moscowTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Moscow" }))
        const hours = moscowTime.getHours()
        const minutes = moscowTime.getMinutes()

        // Convert to minutes for easier comparison
        const currentTimeMinutes = hours * 60 + minutes
        const startTimeMinutes = DRAWING_START_HOUR * 60
        const endTimeMinutes = DRAWING_END_HOUR * 60 + DRAWING_END_MINUTE

        return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes
    }

    // Update time display
    function updateTimeDisplay() {
        // Create date object with Moscow time
        const now = new Date()
        const moscowTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Moscow" }))

        // Format time as HH:MM:SS
        const hours = moscowTime.getHours().toString().padStart(2, "0")
        const minutes = moscowTime.getMinutes().toString().padStart(2, "0")
        const seconds = moscowTime.getSeconds().toString().padStart(2, "0")

        currentTimeDisplay.textContent = `${hours}:${minutes}:${seconds} МСК`

        // Check drawing availability
        checkDrawingAvailability()
    }

    // Check if drawing is currently available
    function checkDrawingAvailability() {
        const allowed = isDrawingAllowed()

        if (allowed && !isMoveMode && !isBombActive) {
            canvasStatus.classList.add("hidden")
            canvas.style.cursor = "crosshair"
        } else if (isMoveMode) {
            canvasStatus.classList.add("hidden")
            canvas.style.cursor = "move"
        } else if (isBombActive) {
            canvasStatus.classList.add("hidden")
            canvas.style.cursor =
                'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="20" r="10" fill="%23222"/><path d="M18,8 Q20,5 22,3" stroke="%23FFA500" stroke-width="1.5" fill="none" stroke-linecap="round"/><circle cx="22" cy="3" r="1.5" fill="%23FF4500"/><rect x="15" y="8" width="3" height="3" fill="%23555" rx="1"/></svg>\'), auto'
        } else {
            canvasStatus.classList.remove("hidden")
            canvas.style.cursor = "not-allowed"
        }
    }

    // Place a pixel on the canvas
    async function placePixelOnCanvas(x, y) {
        // Если активен режим бомбы
        if (isBombActive) {
            await useBomb(x, y)
            return
        }

        // Если активен режим перемещения, не размещаем пиксель
        if (isMoveMode) {
            return
        }

        if (!currentUser) {
            showNotification("Пожалуйста, войдите или зарегистрируйтесь, чтобы размещать пиксели.")
            return
        }

        if (isUserBlocked) {
            showNotification("Ваш аккаунт заблокирован. Вы не можете размещать пиксели.")
            return
        }

        if (!isDrawingAllowed()) {
            showNotification("Рисование доступно только с 06:00 до 23:59 МСК")
            return
        }

        if (isCanvasLocked && !isUserAdmin) {
            showNotification("Холст заблокирован администратором.")
            return
        }

        // Check cooldown for non-admin users
        if (!isUserAdmin) {
            const currentTime = Date.now()
            const timeSinceLastPixel = currentTime - lastPixelTime

            // Премиум пользователи имеют меньшую задержку
            const cooldownTime = isUserPremium ? 500 : 1000 // 0.5 сек для премиум, 1 сек для обычных

            if (timeSinceLastPixel < cooldownTime) {
                const remainingTime = Math.ceil((cooldownTime - timeSinceLastPixel) / 1000)
                showCooldown(remainingTime)
                return
            }
        }

        if (isEraserActive) {
            // Erase pixel
            const { error } = await erasePixel(x, y)

            if (error) {
                console.error("Error erasing pixel:", error)
                showNotification("Ошибка удаления пикселя: " + error.message)
                return
            }

            // Remove from local data
            const key = `${x},${y}`
            delete pixelData[key]
        } else {
            // Place pixel
            const color = colorPicker.value
            const { error } = await placePixel(x, y, color)

            if (error) {
                console.error("Error placing pixel:", error)
                showNotification("Ошибка размещения пикселя: " + error.message)
                return
            }

            // Update local data
            const key = `${x},${y}`
            pixelData[key] = color

            // Увеличиваем счетчик размещенных пикселей
            userPixelsPlaced++

            // Проверяем, достигли ли мы порогов для наград
            for (const threshold in pixelRewards) {
                if (
                    userPixelsPlaced === Number.parseInt(threshold) ||
                    (userPixelsPlaced > 100 && userPixelsPlaced % 50 === 0)
                ) {
                    let reward = 0

                    if (userPixelsPlaced <= 100) {
                        reward = pixelRewards[threshold]
                    } else {
                        reward = 5 // +5 коинов за каждые 50 пикселей после 100
                    }

                    userCoins += reward

                    // Обновляем отображение
                    updateStatsDisplay()

                    // Показываем уведомление
                    showNotification(`+${reward} коинов за размещение ${userPixelsPlaced} пикселей!`)

                    // Обновляем статистику в базе данных
                    await updateUserStats({
                        coins: userCoins,
                        pixels_placed: userPixelsPlaced,
                    })
                }
            }

            // Обновляем статистику каждые 10 пикселей
            if (userPixelsPlaced % 10 === 0) {
                await updateUserStats({
                    pixels_placed: userPixelsPlaced,
                })
            }
        }

        // Update last pixel time
        lastPixelTime = Date.now()

        // Start cooldown for non-admin users
        if (!isUserAdmin) {
            // Премиум пользователи имеют меньшую задержку
            const cooldownTime = isUserPremium ? 0.5 : 2 // 0.5 сек для премиум, 2 сек для обычных
            startCooldown(cooldownTime)
        }

        // Redraw canvas
        drawCanvas()
    }

    // Функция для использования бомбы
    async function useBomb(centerX, centerY) {
        // Получаем ближайшие 10 пикселей (3x3 область вокруг выбранного пикселя + сам пиксель)
        const pixelsToErase = []

        for (let x = centerX - 1; x <= centerX + 1; x++) {
            for (let y = centerY - 1; y <= centerY + 1; y++) {
                const key = `${x},${y}`
                if (pixelData[key]) {
                    pixelsToErase.push({ x, y })
                }
            }
        }

        // Если не нашли 9 пикселей в области 3x3, ищем дальше
        if (pixelsToErase.length < 9) {
            for (let x = centerX - 2; x <= centerX + 2; x++) {
                for (let y = centerY - 2; y <= centerY + 2; y++) {
                    // Пропускаем уже добавленные пиксели
                    if (Math.abs(x - centerX) <= 1 && Math.abs(y - centerY) <= 1) {
                        continue
                    }

                    const key = `${x},${y}`
                    if (pixelData[key] && pixelsToErase.length < 10) {
                        pixelsToErase.push({ x, y })
                    }
                }
            }
        }

        // Если все еще не нашли 10 пикселей, ищем еще дальше
        if (pixelsToErase.length < 10) {
            for (let radius = 3; radius <= 5; radius++) {
                for (let x = centerX - radius; x <= centerX + radius; x++) {
                    for (let y = centerY - radius; y <= centerY + radius; y++) {
                        // Пропускаем уже проверенные области
                        if (Math.abs(x - centerX) <= radius - 1 && Math.abs(y - centerY) <= radius - 1) {
                            continue
                        }

                        const key = `${x},${y}`
                        if (pixelData[key] && pixelsToErase.length < 10) {
                            pixelsToErase.push({ x, y })
                        }
                    }
                }

                if (pixelsToErase.length >= 10) {
                    break
                }
            }
        }

        // Если нашли пиксели для удаления
        if (pixelsToErase.length > 0) {
            // Удаляем пиксели
            for (const pixel of pixelsToErase) {
                const { error } = await erasePixel(pixel.x, pixel.y)

                if (error) {
                    console.error("Error erasing pixel with bomb:", error)
                    continue
                }

                // Удаляем из локальных данных
                const key = `${pixel.x},${pixel.y}`
                delete pixelData[key]
            }

            // Показываем уведомление
            showNotification(`Бомба взорвана! Удалено ${pixelsToErase.length} пикселей.`)

            // Деактивируем режим бомбы
            deactivateBomb()

            // Перерисовываем холст
            drawCanvas()
        } else {
            showNotification("Нет пикселей для удаления в этой области.")
        }
    }

    // Функция для активации режима бомбы
    function activateBomb() {
        isBombActive = true
        canvas.classList.add("bomb-active")
        showNotification("Режим бомбы активирован. Выберите место для взрыва.")
        checkDrawingAvailability()
    }

    // Функция для деактивации режима бомбы
    function deactivateBomb() {
        isBombActive = false
        canvas.classList.remove("bomb-active")
        checkDrawingAvailability()
    }

    // Convert canvas coordinates to grid coordinates
    function canvasToGrid(canvasX, canvasY) {
        const rect = canvas.getBoundingClientRect()
        const x = (canvasX - rect.left - offsetX) / scale
        const y = (canvasY - rect.top - offsetY) / scale

        return {
            x: Math.floor(x / PIXEL_SIZE),
            y: Math.floor(y / PIXEL_SIZE),
        }
    }

    // Show notification
    function showNotification(message) {
        const notification = document.createElement("div")
        notification.className = "notification"
        notification.textContent = message

        document.body.appendChild(notification)

        setTimeout(() => {
            notification.classList.add("show")
        }, 10)

        setTimeout(() => {
            notification.classList.remove("show")
            setTimeout(() => {
                document.body.removeChild(notification)
            }, 300)
        }, 3000)
    }

    // Add cooldown functions
    function showCooldown(seconds) {
        cooldownIndicator.textContent = `Подождите ${seconds} сек...`
        cooldownIndicator.classList.add("active")
        showNotification(`Подождите ${seconds} секунд перед размещением следующего пикселя`)
    }

    function startCooldown(seconds) {
        if (cooldownTimer) {
            clearInterval(cooldownTimer)
        }

        let remainingTime = seconds
        cooldownIndicator.textContent = `Подождите ${remainingTime} сек...`
        cooldownIndicator.classList.add("active")

        cooldownTimer = setInterval(() => {
            remainingTime--

            if (remainingTime <= 0) {
                clearInterval(cooldownTimer)
                cooldownIndicator.classList.remove("active")
            } else {
                cooldownIndicator.textContent = `Подождите ${remainingTime} сек...`
            }
        }, 1000)
    }

    // Функция для генерации капчи
    function generateCaptcha() {
        const num1 = Math.floor(Math.random() * 10) + 1
        const num2 = Math.floor(Math.random() * 10) + 1
        const captchaQuestion = document.getElementById("captcha-question")
        captchaQuestion.textContent = `${num1} + ${num2} = ?`
        return num1 + num2
    }

    // Функция для загрузки статистики пользователя
    async function loadUserStats() {
        const { stats, error } = await getUserStats()

        if (error) {
            console.error("Error loading user stats:", error)
            return
        }

        if (stats) {
            userCoins = stats.coins || 0
            userPixelsPlaced = stats.pixels_placed || 0
            userTotalTime = stats.total_time || 0
            userTotalSeconds = stats.total_seconds || 0

            // Обновляем отображение
            updateStatsDisplay()
        }
    }

    // Функция для обновления отображения статистики
    function updateStatsDisplay() {
        coinsDisplay.textContent = userCoins
        totalTimeDisplay.textContent = formatTime(userTotalTime, userTotalSeconds)
        totalPixelsDisplay.textContent = userPixelsPlaced
        totalCoinsDisplay.textContent = userCoins
    }

    // Функция для форматирования времени
    function formatTime(minutes, seconds) {
        if (!seconds) {
            // Старый формат (только минуты)
            if (minutes < 60) {
                return `${minutes} минут`
            } else {
                const hours = Math.floor(minutes / 60)
                const mins = minutes % 60
                return `${hours} ч ${mins} мин`
            }
        } else {
            // Новый формат (минуты и секунды)
            const hours = Math.floor(seconds / 3600)
            const mins = Math.floor((seconds % 3600) / 60)
            const secs = seconds % 60

            if (hours > 0) {
                return `${hours} ч ${mins} мин ${secs} сек`
            } else {
                return `${mins} мин ${secs} сек`
            }
        }
    }

    // Функция для отслеживания времени на сайте
    function startTimeTracker() {
        // Сбрасываем массивы отслеживания наград
        rewardedTimeThresholds = []

        // Запускаем интервал для проверки времени каждую минуту
        setInterval(async () => {
            if (!currentUser) return

            const currentTime = Date.now()
            const sessionMinutes = Math.floor((currentTime - sessionStartTime) / 60000)
            const currentSeconds = Math.floor(Date.now() / 1000)
            const sessionSeconds = currentSeconds - sessionStartSeconds

            // Проверяем, достигли ли мы порогов для наград
            for (const threshold in timeRewards) {
                if (sessionMinutes >= threshold && !rewardedTimeThresholds.includes(Number.parseInt(threshold))) {
                    const reward = timeRewards[threshold]
                    userCoins += reward
                    rewardedTimeThresholds.push(Number.parseInt(threshold))

                    // Обновляем отображение
                    updateStatsDisplay()

                    // Показываем уведомление
                    showNotification(`+${reward} коинов за ${threshold} минут на сайте!`)

                    // Обновляем статистику в базе данных
                    await updateUserStats({
                        coins: userCoins,
                        total_time: userTotalTime + sessionMinutes,
                        total_seconds: userTotalSeconds + sessionSeconds,
                    })
                }
            }

            // Обновляем общее время каждые 5 минут
            if (sessionMinutes % 5 === 0 && sessionMinutes > 0) {
                userTotalTime += 5
                userTotalSeconds += 300
                updateStatsDisplay()

                await updateUserStats({
                    total_time: userTotalTime,
                    total_seconds: userTotalSeconds,
                })
            }
        }, 60000) // Проверяем каждую минуту
    }

    // Функция для обновления пагинации
    function updatePagination() {
        const paginationContainer = document.getElementById("users-pagination")
        paginationContainer.innerHTML = ""

        const totalPages = Math.ceil(totalUsers / usersPerPage)

        // Кнопка "Предыдущая"
        const prevBtn = document.createElement("button")
        prevBtn.textContent = "Предыдущая"
        prevBtn.className = "pagination-btn"
        prevBtn.disabled = currentPage === 1
        prevBtn.addEventListener("click", () => {
            if (currentPage > 1) {
                loadUsers(currentPage - 1)
            }
        })
        paginationContainer.appendChild(prevBtn)

        // Номера страниц
        const startPage = Math.max(1, currentPage - 2)
        const endPage = Math.min(totalPages, startPage + 4)

        for (let i = startPage; i <= endPage; i++) {
            const pageBtn = document.createElement("button")
            pageBtn.textContent = i
            pageBtn.className = i === currentPage ? "pagination-btn active" : "pagination-btn"
            pageBtn.addEventListener("click", () => {
                loadUsers(i)
            })
            paginationContainer.appendChild(pageBtn)
        }

        // Кнопка "Следующая"
        const nextBtn = document.createElement("button")
        nextBtn.textContent = "Следующая"
        nextBtn.className = "pagination-btn"
        nextBtn.disabled = currentPage === totalPages
        nextBtn.addEventListener("click", () => {
            if (currentPage < totalPages) {
                loadUsers(currentPage + 1)
            }
        })
        paginationContainer.appendChild(nextBtn)

        // Информация о страницах
        const pageInfo = document.createElement("div")
        pageInfo.className = "pagination-info"
        pageInfo.textContent = `Страница ${currentPage} из ${totalPages} (всего ${totalUsers} пользователей)`
        paginationContainer.appendChild(pageInfo)
    }

    // Функция для загрузки топа игроков
    async function loadTopPlayers(sortBy = "pixels_placed") {
        topPlayersList.innerHTML = '<tr><td colspan="3">Загрузка данных...</td></tr>'

        const { players, error } = await getTopPlayers(sortBy)

        if (error) {
            topPlayersList.innerHTML = `<tr><td colspan="3">Ошибка загрузки данных: ${error}</td></tr>`
            return
        }

        if (players.length === 0) {
            topPlayersList.innerHTML = '<tr><td colspan="3">Нет данных для отображения</td></tr>'
            return
        }

        topPlayersList.innerHTML = ""
        players.forEach((player, index) => {
            const row = document.createElement("tr")

            // Ник с учетом статуса пользователя
            const usernameCell = document.createElement("td")

            // Создаем контейнер для имени и статуса
            const usernameContainer = document.createElement("div")
            usernameContainer.className = "username-container"

            // Добавляем имя пользователя с соответствующим классом
            const usernameSpan = document.createElement("span")

            if (player.is_super_admin) {
                usernameSpan.className = "super-admin-username"
                usernameSpan.textContent = player.username

                // Добавляем метку Super admin
                const adminLabel = document.createElement("span")
                adminLabel.className = "admin-label super-admin-label"
                adminLabel.textContent = "Super admin"
                usernameContainer.appendChild(usernameSpan)
                usernameContainer.appendChild(adminLabel)
            } else if (player.is_admin) {
                usernameSpan.className = "admin-username"
                usernameSpan.textContent = player.username

                // Добавляем метку Admin
                const adminLabel = document.createElement("span")
                adminLabel.className = "admin-label admin-label"
                adminLabel.textContent = "Admin"
                usernameContainer.appendChild(usernameSpan)
                usernameContainer.appendChild(adminLabel)
            } else if (player.is_premium) {
                usernameSpan.className = "premium-username"
                usernameSpan.textContent = player.username

                // Добавляем метку Premium
                const premiumLabel = document.createElement("span")
                premiumLabel.className = "premium-label"
                premiumLabel.textContent = "PREMIUM"
                usernameContainer.appendChild(usernameSpan)
                usernameContainer.appendChild(premiumLabel)
            } else {
                usernameSpan.textContent = player.username
                usernameContainer.appendChild(usernameSpan)
            }

            usernameCell.appendChild(usernameContainer)
            row.appendChild(usernameCell)

            // Время в игре
            const timeCell = document.createElement("td")
            timeCell.textContent = player.total_seconds
                ? formatTime(player.total_time, player.total_seconds)
                : formatTime(player.total_time)
            row.appendChild(timeCell)

            // Количество пикселей
            const pixelsCell = document.createElement("td")
            pixelsCell.textContent = player.pixels_placed
            row.appendChild(pixelsCell)

            topPlayersList.appendChild(row)
        })
    }

    // Функция для поиска пользователей (для управления админами)
    async function performUserSearch() {
        const query = adminSearchInput.value.trim()

        if (query.length < 3) {
            adminManagementError.textContent = "Введите не менее 3 символов для поиска"
            return
        }

        adminManagementError.textContent = ""
        adminManagementSuccess.textContent = ""
        adminSearchResults.innerHTML = '<div class="loading">Поиск пользователей...</div>'

        const { users, error } = await searchUsers(query)

        if (error) {
            adminSearchResults.innerHTML = ""
            adminManagementError.textContent = `Ошибка поиска: ${error}`
            return
        }

        if (users.length === 0) {
            adminSearchResults.innerHTML = '<div class="no-results">Пользователи не найдены</div>'
            return
        }

        adminSearchResults.innerHTML = ""

        users.forEach((user) => {
            const userItem = document.createElement("div")
            userItem.className = "search-result-item"

            const userInfo = document.createElement("div")
            userInfo.className = "search-result-info"

            if (user.avatar) {
                const avatar = document.createElement("img")
                avatar.src = user.avatar
                avatar.alt = user.username
                avatar.className = "search-result-avatar"
                userInfo.appendChild(avatar)
            } else {
                const avatarPlaceholder = document.createElement("div")
                avatarPlaceholder.className = "search-result-avatar-placeholder"
                avatarPlaceholder.innerHTML = '<i class="fas fa-user"></i>'
                userInfo.appendChild(avatarPlaceholder)
            }

            const username = document.createElement("div")
            username.className = "search-result-username"

            // Применяем стили к имени пользователя в зависимости от статуса
            if (user.is_super_admin) {
                username.className += " super-admin-username"
            } else if (user.is_admin) {
                username.className += " admin-username"
            } else if (user.is_premium) {
                username.className += " premium-username"
            }

            username.textContent = user.username
            userInfo.appendChild(username)

            if (user.is_super_admin) {
                const adminBadge = document.createElement("div")
                adminBadge.className = "search-result-super-admin"
                adminBadge.textContent = "Главный администратор"
                userInfo.appendChild(adminBadge)
            } else if (user.is_admin) {
                const adminBadge = document.createElement("div")
                adminBadge.className = "search-result-admin"
                adminBadge.textContent = "Администратор"
                userInfo.appendChild(adminBadge)
            } else if (user.is_premium) {
                const premiumBadge = document.createElement("div")
                premiumBadge.className = "search-result-premium"
                premiumBadge.textContent = "Премиум"
                userInfo.appendChild(premiumBadge)
            }

            userItem.appendChild(userInfo)

            const actionButtons = document.createElement("div")
            actionButtons.className = "search-result-actions"

            // Не показываем кнопки для главного администратора
            if (user.is_super_admin) {
                const superAdminBadge = document.createElement("div")
                superAdminBadge.className = "search-result-super-admin"
                superAdminBadge.textContent = "Главный администратор"
                actionButtons.appendChild(superAdminBadge)
            } else {
                if (user.is_admin) {
                    const removeAdminBtn = document.createElement("button")
                    removeAdminBtn.textContent = "Удалить права админа"
                    removeAdminBtn.className = "block-btn"
                    removeAdminBtn.addEventListener("click", async () => {
                        const { success, error } = await removeAdmin(user.username)

                        if (error) {
                            adminManagementError.textContent = error
                            adminManagementSuccess.textContent = ""
                        } else {
                            adminManagementSuccess.textContent = `Права администратора удалены у пользователя ${user.username}`
                            adminManagementError.textContent = ""

                            // Обновляем результаты поиска
                            performUserSearch()
                        }
                    })
                    actionButtons.appendChild(removeAdminBtn)
                } else {
                    const addAdminBtn = document.createElement("button")
                    addAdminBtn.textContent = "Назначить админом"
                    addAdminBtn.className = "unblock-btn"
                    addAdminBtn.addEventListener("click", async () => {
                        const { success, error } = await addAdmin(user.username)

                        if (error) {
                            adminManagementError.textContent = error
                            adminManagementSuccess.textContent = ""
                        } else {
                            adminManagementSuccess.textContent = `Пользователь ${user.username} назначен администратором`
                            adminManagementError.textContent = ""

                            // Обновляем результаты поиска
                            performUserSearch()
                        }
                    })
                    actionButtons.appendChild(addAdminBtn)
                }
            }

            userItem.appendChild(actionButtons)
            adminSearchResults.appendChild(userItem)
        })
    }

    // Set up event listeners
    function setupEventListeners() {
        // Add eraser button event listener
        eraserBtn.addEventListener("click", () => {
            isEraserActive = !isEraserActive

            if (isEraserActive) {
                eraserBtn.classList.add("active")
                showNotification("Режим ластика активирован")
            } else {
                eraserBtn.classList.remove("active")
                showNotification("Режим рисования активирован")
            }
        })

        // Add save settings button event listener
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener("click", async () => {
                settingsError.textContent = ""
                settingsSuccess.textContent = ""

                const settings = {
                    is_locked: canvasLockToggle.checked ? 1 : 0,
                }

                const { error } = await updateCanvasSettings(settings)

                if (error) {
                    settingsError.textContent = error.message
                } else {
                    isCanvasLocked = canvasLockToggle.checked
                    settingsSuccess.textContent = "Настройки успешно сохранены"

                    // Show notification about canvas lock status
                    if (isCanvasLocked) {
                        showNotification("Холст заблокирован для всех пользователей")
                    } else {
                        showNotification("Холст разблокирован для всех пользователей")
                    }

                    setTimeout(() => {
                        settingsSuccess.textContent = ""
                    }, 3000)
                }
            })
        }

        // Auth UI
        loginBtn.addEventListener("click", () => {
            loginModal.style.display = "block"
            loginError.textContent = ""
            loginForm.reset()
        })

        registerBtn.addEventListener("click", () => {
            registerModal.style.display = "block"
            registerError.textContent = ""
            usernameStatus.textContent = ""
            registerForm.reset()
            correctCaptchaAnswer = generateCaptcha()
        })

        showLoginLink.addEventListener("click", (e) => {
            e.preventDefault()
            registerModal.style.display = "none"
            loginModal.style.display = "block"
            loginError.textContent = ""
            loginForm.reset()
        })

        showRegisterLink.addEventListener("click", (e) => {
            e.preventDefault()
            loginModal.style.display = "none"
            registerModal.style.display = "block"
            registerError.textContent = ""
            usernameStatus.textContent = ""
            registerForm.reset()
            correctCaptchaAnswer = generateCaptcha()
        })

        // Username availability check
        let usernameCheckTimeout
        usernameInput.addEventListener("input", () => {
            const username = usernameInput.value.trim()
            usernameStatus.textContent = ""
            usernameStatus.className = "input-status"

            clearTimeout(usernameCheckTimeout)

            if (username.length < 3) {
                return
            }

            usernameCheckTimeout = setTimeout(async () => {
                const { available, error } = await checkUsername(username)

                if (error) {
                    usernameStatus.textContent = error
                    usernameStatus.className = "input-status unavailable"
                    return
                }

                if (available) {
                    usernameStatus.textContent = "Имя пользователя доступно"
                    usernameStatus.className = "input-status available"
                } else {
                    usernameStatus.textContent = "Имя пользователя уже занято"
                    usernameStatus.className = "input-status unavailable"
                }
            }, 500)
        })

        // Form submissions
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault()
            loginError.textContent = ""

            const username = document.getElementById("login-username").value.trim()
            const password = document.getElementById("login-password").value

            if (!username || !password) {
                loginError.textContent = "Пожалуйста, заполните все поля"
                return
            }

            const { user, error } = await login(username, password)

            if (error) {
                loginError.textContent = error.message
                return
            }

            // Close modal and update UI
            loginModal.style.display = "none"
            await handleAuthStateChange(user)
            showNotification("Вы успешно вошли в систему")
        })

        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault()
            registerError.textContent = ""

            const username = usernameInput.value.trim()
            const password = passwordInput.value
            const confirmPassword = confirmPasswordInput.value
            const captchaAnswer = Number.parseInt(document.getElementById("captcha-answer").value)

            if (!username || !password || !confirmPassword) {
                registerError.textContent = "Пожалуйста, заполните все поля"
                return
            }

            if (username.length < 3) {
                registerError.textContent = "Имя пользователя должно содержать не менее 3 символов"
                return
            }

            if (password.length < 6) {
                registerError.textContent = "Пароль должен содержать не менее 6 символов"
                return
            }

            if (password !== confirmPassword) {
                registerError.textContent = "Пароли не совпадают"
                return
            }

            // Проверка капчи
            if (captchaAnswer !== correctCaptchaAnswer) {
                registerError.textContent = "Неверный ответ на капчу"
                correctCaptchaAnswer = generateCaptcha() // Генерируем новую капчу
                return
            }

            // Check username availability one more time
            const { available, error: checkError } = await checkUsername(username)
            if (checkError) {
                registerError.textContent = checkError
                return
            }

            if (!available) {
                registerError.textContent = "Имя пользователя уже занято"
                return
            }

            const { user, error } = await register(username, password)

            if (error) {
                registerError.textContent = error.message
                return
            }

            // Close modal and update UI
            registerModal.style.display = "none"
            await handleAuthStateChange(user)
            showNotification("Вы успешно зарегистрировались")
        })

        logoutBtn.addEventListener("click", async () => {
            await signOut()
        })

        // Обработчики для магазина и профиля
        shopBtn.addEventListener("click", () => {
            shopModal.style.display = "block"
            shopError.textContent = ""
        })

        userAvatar.addEventListener("click", () => {
            profileModal.style.display = "block"
            updateStatsDisplay()
        })

        updatesBtn.addEventListener("click", (e) => {
            e.preventDefault()
            updatesModal.style.display = "block"
        })

        buyBombBtn.addEventListener("click", async () => {
            if (userCoins < 10) {
                shopError.textContent = "Недостаточно коинов для покупки бомбочки"
                return
            }

            const { success, error } = await buyItem("bomb")

            if (error) {
                shopError.textContent = error
                return
            }

            if (success) {
                userCoins -= 10
                updateStatsDisplay()

                // Обновляем статистику в базе данных
                await updateUserStats({
                    coins: userCoins,
                })

                // Закрываем модальное окно магазина
                shopModal.style.display = "none"

                // Активируем режим бомбы
                activateBomb()
            }
        })

        // Добавляем обработчик для кнопки покупки премиума
        if (buyPremiumBtn) {
            buyPremiumBtn.addEventListener("click", async () => {
                if (userCoins < 1000) {
                    shopError.textContent = "Недостаточно коинов для покупки премиума (нужно 1000)"
                    return
                }

                const { success, error } = await buyItem("premium")

                if (error) {
                    shopError.textContent = error
                    return
                }

                if (success) {
                    userCoins -= 1000
                    isUserPremium = true
                    updateStatsDisplay()

                    // Обновляем статистику в базе данных
                    await updateUserStats({
                        coins: userCoins,
                    })

                    // Обновляем отображение имени пользователя
                    usernameDisplay.className = "premium-username"

                    // Закрываем модальное окно магазина
                    shopModal.style.display = "none"

                    // Показываем уведомление
                    showNotification("Вы успешно приобрели премиум-статус на 30 дней!")
                }
            })
        }

        // Top players handlers
        topPlayersBtn.addEventListener("click", (e) => {
            e.preventDefault()
            topPlayersModal.style.display = "block"
            loadTopPlayers("pixels_placed")
            sortByPixelsBtn.classList.add("active")
            sortByTimeBtn.classList.remove("active")
        })

        sortByPixelsBtn.addEventListener("click", () => {
            sortByPixelsBtn.classList.add("active")
            sortByTimeBtn.classList.remove("active")
            loadTopPlayers("pixels_placed")
        })

        sortByTimeBtn.addEventListener("click", () => {
            sortByTimeBtn.classList.add("active")
            sortByPixelsBtn.classList.remove("active")
            loadTopPlayers("total_time")
        })

        // Admin management handlers
        if (adminSearchBtn) {
            adminSearchBtn.addEventListener("click", (e) => {
                e.preventDefault()
                performUserSearch()
            })
        }

        if (adminSearchInput) {
            adminSearchInput.addEventListener("keypress", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault()
                    performUserSearch()
                }
            })
        }

        // Canvas interaction
        canvas.addEventListener("mousedown", (e) => {
            if (e.button === 0) {
                // Left click
                if (isMoveMode || e.shiftKey) {
                    // Если активен режим перемещения или нажата клавиша Shift, начинаем перетаскивание
                    isDragging = true
                    lastX = e.clientX
                    lastY = e.clientY
                    canvas.style.cursor = "grabbing"
                } else {
                    // Иначе размещаем пиксель
                    const { x, y } = canvasToGrid(e.clientX, e.clientY)
                    if (x >= 0 && x < CANVAS_WIDTH / PIXEL_SIZE && y >= 0 && y < CANVAS_HEIGHT / PIXEL_SIZE) {
                        placePixelOnCanvas(x, y)
                    }
                }
            } else if (e.button === 1) {
                // Middle click (pan)
                isDragging = true
                lastX = e.clientX
                lastY = e.clientY
                canvas.style.cursor = "grabbing"
            }
        })

        canvas.addEventListener("mousemove", (e) => {
            // Обновляем индикатор координат
            const { x, y } = canvasToGrid(e.clientX, e.clientY)
            updateCoordsIndicator(x, y)

            if (isDragging) {
                const dx = e.clientX - lastX
                const dy = e.clientY - lastY

                // Рассчитываем новые значения смещения
                const newOffsetX = offsetX + dx
                const newOffsetY = offsetY + dy

                // Получаем размеры контейнера
                const containerWidth = canvasWrapper.clientWidth
                const containerHeight = canvasWrapper.clientHeight

                // Рассчитываем границы для смещения
                const minOffsetX = containerWidth - CANVAS_WIDTH * scale
                const minOffsetY = containerHeight - CANVAS_HEIGHT * scale

                // Применяем ограничения
                offsetX = Math.min(0, Math.max(minOffsetX, newOffsetX))
                offsetY = Math.min(0, Math.max(minOffsetY, newOffsetY))

                lastX = e.clientX
                lastY = e.clientY
                drawCanvas()
            }
        })

        window.addEventListener("mouseup", () => {
            if (isDragging) {
                isDragging = false
                if (isMoveMode) {
                    canvas.style.cursor = "move"
                } else if (isBombActive) {
                    canvas.style.cursor =
                        'url(\'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32"><circle cx="16" cy="20" r="10" fill="%23222"/><path d="M18,8 Q20,5 22,3" stroke="%23FFA500" stroke-width="1.5" fill="none" stroke-linecap="round"/><circle cx="22" cy="3" r="1.5" fill="%23FF4500"/><rect x="15" y="8" width="3" height="3" fill="%23555" rx="1"/></svg>\'), auto'
                } else {
                    canvas.style.cursor = isDrawingAllowed() ? "crosshair" : "not-allowed"
                }
            }
        })

        // Изменить обработчик колесика мыши, чтобы ограничить минимальный масштаб
        canvas.addEventListener("wheel", (e) => {
            e.preventDefault()
            const rect = canvas.getBoundingClientRect()
            const mouseX = e.clientX - rect.left
            const mouseY = e.clientY - rect.top

            // Calculate position before zoom
            const worldX = (mouseX - offsetX) / scale
            const worldY = (mouseY - offsetY) / scale

            // Adjust scale
            if (e.deltaY < 0) {
                scale *= 1.1 // Zoom in
            } else {
                scale /= 1.1 // Zoom out
            }

            // Limit scale - используем minScale вместо фиксированного значения 0.1
            scale = Math.max(minScale, Math.min(scale, 10))

            // Calculate position after zoom
            const newOffsetX = mouseX - worldX * scale
            const newOffsetY = mouseY - worldY * scale

            // Получаем размеры контейнера
            const containerWidth = canvasWrapper.clientWidth
            const containerHeight = canvasWrapper.clientHeight

            // Рассчитываем границы для смещения
            const minOffsetX = containerWidth - CANVAS_WIDTH * scale
            const minOffsetY = containerHeight - CANVAS_HEIGHT * scale

            // Применяем ограничения
            offsetX = Math.min(0, Math.max(minOffsetX, newOffsetX))
            offsetY = Math.min(0, Math.max(minOffsetY, newOffsetY))

            drawCanvas()
        })

        // Zoom controls
        zoomInBtn.addEventListener("click", () => {
            // Получаем центр видимой области
            const containerWidth = canvasWrapper.clientWidth
            const containerHeight = canvasWrapper.clientHeight
            const centerX = containerWidth / 2
            const centerY = containerHeight / 2

            // Рассчитываем мировые координаты центра
            const worldX = (centerX - offsetX) / scale
            const worldY = (centerY - offsetY) / scale

            // Изменяем масштаб
            scale *= 1.2
            scale = Math.min(scale, 10)

            // Рассчитываем новое смещение, чтобы сохранить центр
            const newOffsetX = centerX - worldX * scale
            const newOffsetY = centerY - worldY * scale

            // Применяем ограничения
            const minOffsetX = containerWidth - CANVAS_WIDTH * scale
            const minOffsetY = containerHeight - CANVAS_HEIGHT * scale

            offsetX = Math.min(0, Math.max(minOffsetX, newOffsetX))
            offsetY = Math.min(0, Math.max(minOffsetY, newOffsetY))

            drawCanvas()
        })

        // Изменить обработчик кнопки уменьшения масштаба
        zoomOutBtn.addEventListener("click", () => {
            // Получаем центр видимой области
            const containerWidth = canvasWrapper.clientWidth
            const containerHeight = canvasWrapper.clientHeight
            const centerX = containerWidth / 2
            const centerY = containerHeight / 2

            // Рассчитываем мировые координаты центра
            const worldX = (centerX - offsetX) / scale
            const worldY = (centerY - offsetY) / scale

            // Изменяем масштаб
            scale /= 1.2
            scale = Math.max(minScale, scale) // Используем minScale

            // Рассчитываем новое смещение, чтобы сохранить центр
            const newOffsetX = centerX - worldX * scale
            const newOffsetY = centerY - worldY * scale

            // Применяем ограничения
            const minOffsetX = containerWidth - CANVAS_WIDTH * scale
            const minOffsetY = containerHeight - CANVAS_HEIGHT * scale

            offsetX = Math.min(0, Math.max(minOffsetX, newOffsetX))
            offsetY = Math.min(0, Math.max(minOffsetY, newOffsetY))

            drawCanvas()
        })

        resetViewBtn.addEventListener("click", () => {
            scale = 1
            centerCanvas()
        })

        adminPanelBtn.addEventListener("click", () => {
            adminModal.style.display = "block"
            loadUsers(1) // Загружаем первую страницу пользователей
        })

        // Close modals
        closeBtns.forEach((btn) => {
            btn.addEventListener("click", () => {
                loginModal.style.display = "none"
                registerModal.style.display = "none"
                adminModal.style.display = "none"
                shopModal.style.display = "none"
                profileModal.style.display = "none"
                updatesModal.style.display = "none"
                topPlayersModal.style.display = "none"
            })
        })

        // Close modal when clicking outside
        window.addEventListener("click", (e) => {
            if (e.target === loginModal) loginModal.style.display = "none"
            if (e.target === registerModal) registerModal.style.display = "none"
            if (e.target === adminModal) adminModal.style.display = "none"
            if (e.target === shopModal) shopModal.style.display = "none"
            if (e.target === profileModal) profileModal.style.display = "none"
            if (e.target === updatesModal) updatesModal.style.display = "none"
            if (e.target === topPlayersModal) topPlayersModal.style.display = "none"
        })

        // Tab switching in admin panel
        tabBtns.forEach((btn) => {
            btn.addEventListener("click", function () {
                const tabId = this.getAttribute("data-tab")

                // Update active tab button
                tabBtns.forEach((b) => b.classList.remove("active"))
                this.classList.add("active")

                // Show selected tab content, hide others
                document.querySelectorAll(".tab-content").forEach((content) => {
                    content.classList.add("hidden")
                })
                document.getElementById(tabId).classList.remove("hidden")
            })
        })

        clearPixelsForm.addEventListener("submit", async (e) => {
            e.preventDefault()

            const startX = Number.parseInt(document.getElementById("start-x").value)
            const startY = Number.parseInt(document.getElementById("start-y").value)
            const endX = Number.parseInt(document.getElementById("end-x").value)
            const endY = Number.parseInt(document.getElementById("end-y").value)

            clearError.textContent = ""

            const { error } = await clearPixels(startX, startY, endX, endY)

            if (error) {
                clearError.textContent = error.message || error
            } else {
                showNotification("Область успешно очищена!")
                await loadCanvas()
                drawCanvas()
                clearPixelsForm.reset()
            }
        })

        // Обработчик изменения размера окна
        window.addEventListener("resize", () => {
            resizeCanvas()
        })

        // Set up real-time canvas updates
        setInterval(async () => {
            await loadCanvas()
            drawCanvas()
        }, 10000) // Update every 10 seconds
    }

    // Исправляем функцию loadUsers, чтобы корректно отображать статус администратора и добавить кнопки управления правами
    async function loadUsers(page = 1) {
        if (!isUserAdmin) return

        const usersList = document.getElementById("users-list")
        usersList.innerHTML = '<tr><td colspan="6">Загрузка пользователей...</td></tr>'

        const { users, totalUsers: total, error } = await getUsers(page)

        // Обновляем глобальную переменную
        totalUsers = total
        currentPage = page

        if (error) {
            usersError.textContent = error.message || error
            return
        }

        if (users.length === 0) {
            usersList.innerHTML = '<tr><td colspan="6">Пользователи не найдены</td></tr>'
            return
        }

        usersList.innerHTML = ""
        users.forEach((user) => {
            const row = document.createElement("tr")

            // Avatar
            const avatarCell = document.createElement("td")
            if (user.avatar) {
                const avatar = document.createElement("img")
                avatar.src = user.avatar
                avatar.alt = user.username
                avatar.className = "user-table-avatar"
                avatarCell.appendChild(avatar)
            } else {
                avatarCell.textContent = "—"
            }
            row.appendChild(avatarCell)

            // Username with status styling
            const usernameCell = document.createElement("td")
            const usernameSpan = document.createElement("span")

            if (user.is_super_admin) {
                usernameSpan.className = "super-admin-username"
                usernameSpan.textContent = user.username + " Super admin"
            } else if (user.is_admin) {
                usernameSpan.className = "admin-username"
                usernameSpan.textContent = user.username + " Admin"
            } else if (user.is_premium) {
                usernameSpan.className = "premium-username"
                usernameSpan.textContent = user.username

                const premiumLabel = document.createElement("span")
                premiumLabel.className = "premium-label"
                premiumLabel.textContent = "PREMIUM"
                usernameSpan.appendChild(document.createTextNode(" "))
                usernameSpan.appendChild(premiumLabel)
            } else {
                usernameSpan.textContent = user.username
            }

            usernameCell.appendChild(usernameSpan)
            row.appendChild(usernameCell)

            // Admin status - исправляем отображение статуса администратора
            const adminCell = document.createElement("td")
            const isAdmin = user.is_admin === 1 || user.is_admin === true
            const isSuperAdmin = user.is_super_admin === 1 || user.is_super_admin === true

            if (isSuperAdmin) {
                adminCell.textContent = "Главный админ"
                adminCell.className = "super-admin-username"
            } else if (isAdmin) {
                adminCell.textContent = "Да"
                adminCell.className = "admin-username"
            } else {
                adminCell.textContent = "Нет"
            }

            row.appendChild(adminCell)

            // Last login
            const lastLoginCell = document.createElement("td")
            if (user.last_login) {
                const lastLoginDate = new Date(user.last_login)
                lastLoginCell.textContent = lastLoginDate.toLocaleString()
            } else {
                lastLoginCell.textContent = "Никогда"
            }
            row.appendChild(lastLoginCell)

            // Blocked status
            const statusCell = document.createElement("td")
            const isBlocked = user.is_blocked === 1 || user.is_blocked === true
            statusCell.textContent = isBlocked ? "Заблокирован" : "Активен"
            statusCell.style.color = isBlocked ? "#ff4d4d" : "#4dff4d"
            row.appendChild(statusCell)

            // Actions
            const actionsCell = document.createElement("td")
            const actionsContainer = document.createElement("div")
            actionsContainer.className = "user-actions"

            if (user.id !== currentUser.id) {
                // Кнопка блокировки/разблокировки
                const blockBtn = document.createElement("button")
                blockBtn.textContent = isBlocked ? "Разблокировать" : "Заблокировать"
                blockBtn.className = isBlocked ? "unblock-btn" : "block-btn"
                blockBtn.addEventListener("click", async () => {
                    if (isBlocked) {
                        const result = await unblockUser(user.id)
                        if (result.error) {
                            usersError.textContent = result.error.message || "Ошибка при разблокировке пользователя"
                        } else {
                            showNotification(`Пользователь ${user.username} разблокирован`)
                            loadUsers(currentPage) // Перезагружаем текущую страницу
                        }
                    } else {
                        const result = await blockUser(user.id)
                        if (result.error) {
                            usersError.textContent = result.error.message || "Ошибка при блокировке пользователя"
                        } else {
                            showNotification(`Пользователь ${user.username} заблокирован`)
                            loadUsers(currentPage) // Перезагружаем текущую страницу
                        }
                    }
                })
                actionsContainer.appendChild(blockBtn)

                // Добавляем кнопки управления правами администратора для супер-админа
                if (isUserSuperAdmin && !user.is_super_admin) {
                    const adminBtn = document.createElement("button")
                    adminBtn.textContent = isAdmin ? "Снять админа" : "Назначить админом"
                    adminBtn.className = isAdmin ? "remove-admin-btn" : "add-admin-btn"
                    adminBtn.style.marginLeft = "5px"

                    adminBtn.addEventListener("click", async () => {
                        if (isAdmin) {
                            const result = await removeAdmin(user.username)
                            if (result.error) {
                                usersError.textContent = result.error.message || "Ошибка при снятии прав администратора"
                            } else {
                                showNotification(`Права администратора сняты у пользователя ${user.username}`)
                                loadUsers(currentPage) // Перезагружаем текущую страницу
                            }
                        } else {
                            const result = await addAdmin(user.username)
                            if (result.error) {
                                usersError.textContent = result.error.message || "Ошибка при назначении администратором"
                            } else {
                                showNotification(`Пользователь ${user.username} назначен администратором`)
                                loadUsers(currentPage) // Перезагружаем текущую страницу
                            }
                        }
                    })
                    actionsContainer.appendChild(adminBtn)
                }
            } else {
                const selfLabel = document.createElement("span")
                selfLabel.textContent = "(Вы)"
                actionsContainer.appendChild(selfLabel)
            }

            actionsCell.appendChild(actionsContainer)
            row.appendChild(actionsCell)
            usersList.appendChild(row)
        })

        // Обновляем пагинацию
        updatePagination()
    }

    // Initialize the app
    init()
})
  