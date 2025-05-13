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
    let isUserBlocked = false

    // Drawing time restrictions (Moscow time)
    const DRAWING_START_HOUR = 6 // 06:00
    const DRAWING_END_HOUR = 23
    const DRAWING_END_MINUTE = 59 // 23:59

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

    async function getUsers() {
        try {
            const response = await fetch("api/users.php?action=get")
            const data = await response.json()

            if (data.error) {
                console.error("Error getting users:", data.error)
                return { users: [], error: { message: data.error } }
            }

            return { users: data.users, error: null }
        } catch (error) {
            console.error("Unexpected error getting users:", error)
            return { users: [], error: { message: error.message } }
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
        // Исправляем проверку админских прав - преобразуем строку в число
        isUserAdmin = user.is_admin === 1 || user.is_admin === true
        isUserBlocked = user.is_blocked === 1 || user.is_blocked === true

        console.log("User data:", user)
        console.log("isUserAdmin:", isUserAdmin, "Type:", typeof isUserAdmin)

        // Update UI
        loggedOutContainer.classList.add("hidden")
        loggedInContainer.classList.remove("hidden")
        usernameDisplay.textContent = user.username

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
        } else {
            adminPanelBtn.classList.add("hidden")
            console.log("Пользователь не является администратором, is_admin =", user.is_admin)
        }
    }

    // Handle sign out
    function handleSignOut() {
        currentUser = null
        isUserAdmin = false
        isUserBlocked = false

        // Update UI
        loggedOutContainer.classList.remove("hidden")
        loggedInContainer.classList.add("hidden")
        usernameDisplay.textContent = ""
        userAvatar.classList.add("hidden")
        adminPanelBtn.classList.add("hidden")
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
            Math.ceil((canvas.height - offsetY) / scale / PIXEL_SIZE +1),
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

        if (allowed && !isMoveMode) {
            canvasStatus.classList.add("hidden")
            canvas.style.cursor = "crosshair"
        } else if (isMoveMode) {
            canvasStatus.classList.add("hidden")
            canvas.style.cursor = "move"
        } else {
            canvasStatus.classList.remove("hidden")
            canvas.style.cursor = "not-allowed"
        }
    }

    // Place a pixel on the canvas
    async function placePixelOnCanvas(x, y) {
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

            if (timeSinceLastPixel < 2000) {
                // 2 seconds in milliseconds
                const remainingTime = Math.ceil((2000 - timeSinceLastPixel) / 1000)
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
        }

        // Update last pixel time
        lastPixelTime = Date.now()

        // Start cooldown for non-admin users
        if (!isUserAdmin) {
            startCooldown(2) // 2 seconds cooldown
        }

        // Redraw canvas
        drawCanvas()
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
            loadUsers()
        })

        // Close modals
        closeBtns.forEach((btn) => {
            btn.addEventListener("click", () => {
                loginModal.style.display = "none"
                registerModal.style.display = "none"
                adminModal.style.display = "none"
            })
        })

        // Close modal when clicking outside
        window.addEventListener("click", (e) => {
            if (e.target === loginModal) loginModal.style.display = "none"
            if (e.target === registerModal) registerModal.style.display = "none"
            if (e.target === adminModal) adminModal.style.display = "none"
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

    // Load users for admin panel
    async function loadUsers() {
        if (!isUserAdmin) return

        const usersList = document.getElementById("users-list")
        usersList.innerHTML = '<tr><td colspan="5">Loading users...</td></tr>'

        const { users, error } = await getUsers()

        if (error) {
            usersError.textContent = error.message || error
            return
        }

        if (users.length === 0) {
            usersList.innerHTML = '<tr><td colspan="5">No users found</td></tr>'
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

            // Username
            const usernameCell = document.createElement("td")
            usernameCell.textContent = user.username
            row.appendChild(usernameCell)

            // Admin status
            const adminCell = document.createElement("td")
            adminCell.textContent = user.is_admin ? "Yes" : "No"
            row.appendChild(adminCell)

            // Last login
            const lastLoginCell = document.createElement("td")
            if (user.last_login) {
                const lastLoginDate = new Date(user.last_login)
                lastLoginCell.textContent = lastLoginDate.toLocaleString()
            } else {
                lastLoginCell.textContent = "Never"
            }
            row.appendChild(lastLoginCell)

            // Blocked status
            const statusCell = document.createElement("td")
            statusCell.textContent = user.is_blocked ? "Blocked" : "Active"
            statusCell.style.color = user.is_blocked ? "#ff4d4d" : "#4dff4d"
            row.appendChild(statusCell)

            // Actions
            const actionsCell = document.createElement("td")

            if (user.id !== currentUser.id) {
                // Don't allow actions on self
                const blockBtn = document.createElement("button")
                blockBtn.textContent = user.is_blocked ? "Unblock" : "Block"
                blockBtn.className = user.is_blocked ? "unblock-btn" : "block-btn"
                blockBtn.addEventListener("click", async () => {
                    if (user.is_blocked) {
                        await unblockUser(user.id)
                    } else {
                        await blockUser(user.id)
                    }
                    loadUsers() // Reload the user list
                })
                actionsCell.appendChild(blockBtn)
            } else {
                actionsCell.textContent = "(You)"
            }

            row.appendChild(actionsCell)
            usersList.appendChild(row)
        })
    }

    // Initialize the app
    init()
})
  