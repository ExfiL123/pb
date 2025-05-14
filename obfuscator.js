// Функция для обфускации строк
function obfuscateString(str) {
    return Array.from(str)
        .map((char) => char.charCodeAt(0))
        .join(",")
}

// Функция для деобфускации строк
function deobfuscateString(obfuscated) {
    return obfuscated
        .split(",")
        .map((code) => String.fromCharCode(Number.parseInt(code)))
        .join("")
}

// Функция для динамической загрузки кода
function loadObfuscatedCode(obfuscatedCode) {
    const code = deobfuscateString(obfuscatedCode)
    const script = document.createElement("script")
    script.textContent = code
    document.head.appendChild(script)
}

// Функция для защиты от отладки
function setupAntiDebug() {
    // Обнаружение открытия инструментов разработчика
    let devtoolsOpen = false

    // Метод 1: Проверка размера окна
    const threshold = 160
    const widthThreshold = window.outerWidth - window.innerWidth > threshold
    const heightThreshold = window.outerHeight - window.innerHeight > threshold
    if (widthThreshold || heightThreshold) {
        devtoolsOpen = true
    }

    // Метод 2: Проверка с помощью console.debug
    const div = document.createElement("div")
    let loop = 0
    let suspicious = 0

    Object.defineProperty(div, "id", {
        get: () => {
            loop++
            if (loop > 1) {
                suspicious++
            }
            return ""
        },
    })

    console.debug(div)
    console.clear()

    if (suspicious > 0) {
        devtoolsOpen = true
    }

    // Метод 3: Проверка времени выполнения функции
    const start = performance.now()
    debugger
    const end = performance.now()

    if (end - start > 100) {
        devtoolsOpen = true
    }

    // Если обнаружены инструменты разработчика, блокируем функциональность
    if (devtoolsOpen) {
        // Блокируем функциональность сайта
        document.body.innerHTML =
            "<h1>Доступ заблокирован</h1><p>Пожалуйста, закройте инструменты разработчика для продолжения.</p>"

        // Постоянно проверяем, не закрыты ли инструменты разработчика
        setInterval(() => {
            window.location.reload()
        }, 3000)
    }

    // Блокируем правый клик
    document.addEventListener("contextmenu", (e) => {
        e.preventDefault()
        return false
    })

    // Блокируем клавиши для инструментов разработчика
    document.addEventListener("keydown", (e) => {
        // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
        if (e.keyCode === 123 || (e.ctrlKey && e.shiftKey && (e.keyCode === 73 || e.keyCode === 74 || e.keyCode === 67))) {
            e.preventDefault()
            return false
        }
    })

    // Постоянная проверка на отладчик
    setInterval(() => {
        const start = performance.now()
        debugger
        const end = performance.now()

        if (end - start > 100) {
            window.location.reload()
        }
    }, 1000)
}

// Функция для защиты от копирования кода
function protectFromCopying() {
    // Блокируем выделение текста
    document.addEventListener("selectstart", (e) => {
        e.preventDefault()
        return false
    })

    // Блокируем копирование
    document.addEventListener("copy", (e) => {
        e.preventDefault()
        return false
    })

    // Блокируем просмотр исходного кода
    document.addEventListener("keydown", (e) => {
        // Ctrl+U
        if (e.ctrlKey && e.keyCode === 85) {
            e.preventDefault()
            return false
        }
    })
}

// Инициализация защиты
function initProtection() {
    setupAntiDebug()
    protectFromCopying()

    // Периодически проверяем, не пытаются ли обойти защиту
    setInterval(setupAntiDebug, 2000)
}

// Запускаем защиту при загрузке страницы
window.addEventListener("DOMContentLoaded", initProtection)
  