document.addEventListener("DOMContentLoaded", () => {
    // Canvas setup
    const canvas = document.getElementById("pixel-canvas")
    const ctx = canvas.getContext("2d")
    const canvasWrapper = document.getElementById("canvas-wrapper")
    const canvasStatus = document.getElementById("canvas-status")
    const currentTimeDisplay = document.getElementById("current-time")

    // Canvas settings
    const CANVAS_WIDTH = 2000
    const CANVAS_HEIGHT = 2000
    const PIXEL_SIZE = 10
    const GRID_COLOR = "#2a2a40"

    // Set canvas dimensions
    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT

    // View state
    let scale = 1
    let offsetX = 0
    let offsetY = 0
    let isDragging = false
    let lastX, lastY

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

    const logoutBtn = document.getElementById("logout-btn")

    const adminModal = document.getElementById("admin-modal")

    const clearPixelsForm = document.getElementById("clear-pixels-form")

    const clearError = document.getElementById("clear-error")
    const usersError = document.getElementById("users-error")

    const closeBtns = document.querySelectorAll(".close")
    const tabBtns = document.querySelectorAll(".tab-btn")

    // Functions for API interaction
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
    }

    // Handle authentication state change
    async function handleAuthStateChange(user) {
        currentUser = user
        isUserAdmin = user.is_admin
        isUserBlocked = user.is_blocked || false

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

        if (isUserAdmin) {
            adminPanelBtn.classList.remove("hidden")
        } else {
            adminPanelBtn.classList.add("hidden")
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

        for (let x = 0; x <= CANVAS_WIDTH; x += PIXEL_SIZE) {
            ctx.beginPath()
            ctx.moveTo(x, 0)
            ctx.lineTo(x, CANVAS_HEIGHT)
            ctx.stroke()
        }

        for (let y = 0; y <= CANVAS_HEIGHT; y += PIXEL_SIZE) {
            ctx.beginPath()
            ctx.moveTo(0, y)
            ctx.lineTo(CANVAS_WIDTH, y)
            ctx.stroke()
        }

        // Draw pixels
        for (const key in pixelData) {
            const [x, y] = key.split(",").map(Number)
            ctx.fillStyle = pixelData[key]
            ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE)
        }

        ctx.restore()
    }

    // Check if drawing is allowed at current time (Moscow time)
    function isDrawingAllowed() {
        // Create date object with Moscow time
        const now = new Date()
        const moscowTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Moscow" }))
        const hours = moscowTime.getHours()
        const minutes = moscowTime.getMinutes()

        // Convert to minutes for easier comparison
        const currentTimeMinutes = hours * 60 + minutes
        const startTimeMinutes = DRAWING_START_HOUR * 60
        const endTimeMinutes = DRAWING_END_HOUR * 60 + DRAWING_END_MINUTE

        return (currentTimeMinutes >= startTimeMinutes && currentTimeMinutes <= endTimeMinutes)
    }

    // Update time display
    function updateTimeDisplay() {
        // Create date object with Moscow time
        const now = new Date()
        const moscowTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Moscow" }))

        // Format time as HH:MM:SS
        const hours = moscowTime.getHours().toString().padStart(2, '0')
        const minutes = moscowTime.getMinutes().toString().padStart(2, '0')
        const seconds = moscowTime.getSeconds().toString().padStart(2, '0')

        currentTimeDisplay.textContent = `${hours}:${minutes}:${seconds} МСК`

        // Check drawing availability
        checkDrawingAvailability()
    }

    // Check if drawing is currently available
    function checkDrawingAvailability() {
        const allowed = isDrawingAllowed()

        if (allowed) {
            canvasStatus.classList.add("hidden")
            canvas.style.cursor = "crosshair"
        } else {
            canvasStatus.classList.remove("hidden")
            canvas.style.cursor = "not-allowed"
        }
    }

    // Place a pixel on the canvas
    async function placePixelOnCanvas(x, y) {
        if (!currentUser) {
            showNotification("Пожалуйста, войдите через ВКонтакте, чтобы размещать пиксели.")
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

    // Set up event listeners
    function setupEventListeners() {
        // Canvas interaction
        canvas.addEventListener("mousedown", (e) => {
            if (e.button === 0) {
                // Left click
                const { x, y } = canvasToGrid(e.clientX, e.clientY)
                if (x >= 0 && x < CANVAS_WIDTH / PIXEL_SIZE && y >= 0 && y < CANVAS_HEIGHT / PIXEL_SIZE) {
                    placePixelOnCanvas(x, y)
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
            if (isDragging) {
                const dx = e.clientX - lastX
                const dy = e.clientY - lastY
                offsetX += dx
                offsetY += dy
                lastX = e.clientX
                lastY = e.clientY
                drawCanvas()
            }
        })

        window.addEventListener("mouseup", () => {
            if (isDragging) {
                isDragging = false
                canvas.style.cursor = isDrawingAllowed() ? "crosshair" : "not-allowed"
            }
        })

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

            // Limit scale
            scale = Math.max(0.1, Math.min(scale, 10))

            // Calculate position after zoom
            offsetX = mouseX - worldX * scale
            offsetY = mouseY - worldY * scale

            drawCanvas()
        })

        // Zoom controls
        zoomInBtn.addEventListener("click", () => {
            scale *= 1.2
            scale = Math.min(scale, 10)
            drawCanvas()
        })

        zoomOutBtn.addEventListener("click", () => {
            scale /= 1.2
            scale = Math.max(scale, 0.1)
            drawCanvas()
        })

        resetViewBtn.addEventListener("click", () => {
            scale = 1
            offsetX = 0
            offsetY = 0
            drawCanvas()
        })

        // Auth UI
        logoutBtn.addEventListener("click", async () => {
            await signOut()
        })

        adminPanelBtn.addEventListener("click", () => {
            adminModal.style.display = "block"
            loadUsers()
        })

        // Close modals
        closeBtns.forEach((btn) => {
            btn.addEventListener("click", () => {
                adminModal.style.display = "none"
            })
        })

        // Close modal when clicking outside
        window.addEventListener("click", (e) => {
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
                showNotification("Area successfully cleared!")
                await loadCanvas()
                drawCanvas()
                clearPixelsForm.reset()
            }
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
        usersList.innerHTML = '<tr><td colspan="6">Loading users...</td></tr>'

        const { users, error } = await getUsers()

        if (error) {
            usersError.textContent = error.message || error
            return
        }

        if (users.length === 0) {
            usersList.innerHTML = '<tr><td colspan="6">No users found</td></tr>'
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

            // VK ID
            const vkIdCell = document.createElement("td")
            if (user.vk_id) {
                const vkLink = document.createElement("a")
                vkLink.href = `https://vk.com/id${user.vk_id}`
                vkLink.textContent = user.vk_id
                vkLink.target = "_blank"
                vkIdCell.appendChild(vkLink)
            } else {
                vkIdCell.textContent = "—"
            }
            row.appendChild(vkIdCell)

            // Admin status
            const adminCell = document.createElement("td")
            adminCell.textContent = user.is_admin ? "Yes" : "No"
            row.appendChild(adminCell)

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