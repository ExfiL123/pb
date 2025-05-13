<?php
require_once '../db-config.php';
session_start();

header('Content-Type: application/json');

// Get request data
$data = json_decode(file_get_contents('php://input'), true);
$action = isset($_GET['action']) ? $_GET['action'] : '';

// Process different actions
switch ($action) {
    case 'login':
        login($conn, $data);
        break;
    case 'register':
        register($conn, $data);
        break;
    case 'logout':
        logout();
        break;
    case 'check':
        checkAuth();
        break;
    case 'check_username':
        checkUsername($conn, $data);
        break;
    default:
        echo json_encode(['error' => 'Unknown action']);
        break;
}

// Функция для регистрации нового пользователя
function register($conn, $data) {
    $username = $data['username'] ?? '';
    $password = $data['password'] ?? '';
    
    // Проверка наличия обязательных полей
    if (empty($username) || empty($password)) {
        echo json_encode(['error' => 'Необходимо указать имя пользователя и пароль']);
        return;
    }
    
    // Проверка длины имени пользователя
    if (strlen($username) < 3) {
        echo json_encode(['error' => 'Имя пользователя должно содержать не менее 3 символов']);
        return;
    }
    
    // Проверка длины пароля
    if (strlen($password) < 6) {
        echo json_encode(['error' => 'Пароль должен содержать не менее 6 символов']);
        return;
    }
    
    // Проверка доступности имени пользователя
    $stmt = $conn->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        echo json_encode(['error' => 'Имя пользователя уже занято']);
        return;
    }
    
    // Хеширование пароля
    $hashed_password = password_hash($password, PASSWORD_DEFAULT);
    
    // Создание нового пользователя
    $stmt = $conn->prepare("INSERT INTO users (username, password, is_admin, is_blocked, created_at) VALUES (?, ?, 0, 0, NOW())");
    $stmt->bind_param("ss", $username, $hashed_password);
    
    if ($stmt->execute()) {
        $user_id = $stmt->insert_id;
        
        // Установка данных сессии
        $_SESSION['user_id'] = $user_id;
        $_SESSION['username'] = $username;
        $_SESSION['is_admin'] = 0;
        $_SESSION['is_blocked'] = 0;
        $_SESSION['avatar'] = null;
        
        echo json_encode([
            'success' => true,
            'user' => [
                'id' => $user_id,
                'username' => $username,
                'is_admin' => 0,
                'is_blocked' => 0,
                'avatar' => null
            ]
        ]);
    } else {
        echo json_encode(['error' => 'Ошибка при регистрации: ' . $conn->error]);
    }
}

// Функция для входа пользователя
function login($conn, $data) {
    $username = $data['username'] ?? '';
    $password = $data['password'] ?? '';
    
    // Проверка наличия обязательных полей
    if (empty($username) || empty($password)) {
        echo json_encode(['error' => 'Необходимо указать имя пользователя и пароль']);
        return;
    }
    
    // Поиск пользователя в базе данных
    $stmt = $conn->prepare("SELECT id, username, password, is_admin, is_blocked, avatar FROM users WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode(['error' => 'Неверное имя пользователя или пароль']);
        return;
    }
    
    $user = $result->fetch_assoc();
    
    // Проверка пароля
    if (!password_verify($password, $user['password'])) {
        echo json_encode(['error' => 'Неверное имя пользователя или пароль']);
        return;
    }
    
    // Проверка, не заблокирован ли пользователь
    if ((int)$user['is_blocked'] === 1) {
        echo json_encode(['error' => 'Ваш аккаунт заблокирован']);
        return;
    }
    
    // Обновление времени последнего входа
    $stmt = $conn->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
    $stmt->bind_param("i", $user['id']);
    $stmt->execute();
    
    // Установка данных сессии с явным преобразованием типов
    $_SESSION['user_id'] = (int)$user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['is_admin'] = (int)$user['is_admin'];
    $_SESSION['is_blocked'] = (int)$user['is_blocked'];
    $_SESSION['avatar'] = $user['avatar'];
    
    echo json_encode([
        'success' => true,
        'user' => [
            'id' => (int)$user['id'],
            'username' => $user['username'],
            'is_admin' => (int)$user['is_admin'],
            'is_blocked' => (int)$user['is_blocked'],
            'avatar' => $user['avatar']
        ]
    ]);
}

// Функция для выхода пользователя
function logout() {
    // Очистка сессии
    session_unset();
    session_destroy();
    
    echo json_encode(['success' => true]);
}

// Функция для проверки авторизации
function checkAuth() {
    if (isset($_SESSION['user_id'])) {
        echo json_encode([
            'user' => [
                'id' => (int)$_SESSION['user_id'],
                'username' => $_SESSION['username'],
                'is_admin' => (int)$_SESSION['is_admin'],
                'is_blocked' => isset($_SESSION['is_blocked']) ? (int)$_SESSION['is_blocked'] : 0,
                'avatar' => $_SESSION['avatar'] ?? null
            ]
        ]);
    } else {
        echo json_encode(['user' => null]);
    }
}

// Функция для проверки доступности имени пользователя
function checkUsername($conn, $data) {
    $username = $data['username'] ?? '';
    
    if (empty($username)) {
        echo json_encode(['error' => 'Необходимо указать имя пользователя']);
        return;
    }
    
    $stmt = $conn->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();
    
    echo json_encode(['available' => ($result->num_rows === 0)]);
}
?>
