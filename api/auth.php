<?php
require_once '../db-config.php';
session_start();

header('Content-Type: application/json');

// Получаем действие из параметра запроса
$action = isset($_GET['action']) ? $_GET['action'] : '';

// Обрабатываем различные действия
switch ($action) {
    case 'register':
        register($conn);
        break;
    case 'login':
        login($conn);
        break;
    case 'logout':
        logout();
        break;
    case 'check':
        checkAuth();
        break;
    case 'check_username':
        checkUsername($conn);
        break;
    case 'add_admin':
        addAdmin($conn);
        break;
    case 'remove_admin':
        removeAdmin($conn);
        break;
    default:
        echo json_encode(['error' => 'Unknown action']);
        break;
}

// Функция для проверки количества аккаунтов с одного IP
function checkIPLimit($conn, $ip_address) {
    $stmt = $conn->prepare("SELECT COUNT(*) as count FROM users WHERE registration_ip = ?");
    $stmt->bind_param("s", $ip_address);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    
    // Исправлено: возвращаем true, только если меньше 3 аккаунтов
    return (int)$row['count'] < 3;
}

// Функция для проверки, является ли пользователь главным администратором
function isSuperAdmin($conn, $user_id) {
    $stmt = $conn->prepare("SELECT is_super_admin FROM users WHERE id = ?");
    $stmt->bind_param("s", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        return false;
    }
    
    $user = $result->fetch_assoc();
    return (int)$user['is_super_admin'] === 1;
}

// Функция для регистрации нового пользователя
function register($conn) {
    // Получаем данные из запроса
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Проверяем наличие необходимых полей
    if (!isset($data['username']) || !isset($data['password'])) {
        echo json_encode(['error' => 'Username and password are required']);
        return;
    }
    
    $username = trim($data['username']);
    $password = $data['password'];
    
    // Проверяем длину имени пользователя
    if (strlen($username) < 3) {
        echo json_encode(['error' => 'Username must be at least 3 characters long']);
        return;
    }
    
    // Проверяем длину пароля
    if (strlen($password) < 6) {
        echo json_encode(['error' => 'Password must be at least 6 characters long']);
        return;
    }
    
    // Проверяем, существует ли уже пользователь с таким именем
    $stmt = $conn->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        echo json_encode(['error' => 'Username already exists']);
        return;
    }
    
    // Получаем IP пользователя
    $ip_address = $_SERVER['REMOTE_ADDR'];
    
    // Проверяем лимит аккаунтов с этого IP
    if (!checkIPLimit($conn, $ip_address)) {
        echo json_encode(['error' => 'Достигнут лимит аккаунтов с вашего IP-адреса (максимум 3)']);
        return;
    }
    
    // Хешируем пароль
    $hashed_password = password_hash($password, PASSWORD_DEFAULT);
    
    // Создаем нового пользователя
    $stmt = $conn->prepare("INSERT INTO users (username, password, registration_ip, created_at) VALUES (?, ?, ?, NOW())");
    $stmt->bind_param("sss", $username, $hashed_password, $ip_address);
    
    if ($stmt->execute()) {
        $user_id = $stmt->insert_id;
        
        // Создаем запись в таблице статистики пользователя
        $stmt = $conn->prepare("INSERT INTO user_stats (user_id, coins, pixels_placed, total_time, total_seconds) VALUES (?, 0, 0, 0, 0)");
        $stmt->bind_param("s", $user_id);
        $stmt->execute();
        
        // Создаем сессию для нового пользователя
        $_SESSION['user_id'] = $user_id;
        $_SESSION['username'] = $username;
        $_SESSION['is_admin'] = 0;
        $_SESSION['is_super_admin'] = 0;
        $_SESSION['is_premium'] = 0;
        
        // Возвращаем данные пользователя
        echo json_encode([
            'user' => [
                'id' => $user_id,
                'username' => $username,
                'is_admin' => false,
                'is_super_admin' => false,
                'is_premium' => false,
                'is_blocked' => false,
                'avatar' => null
            ]
        ]);
    } else {
        echo json_encode(['error' => 'Error creating user: ' . $conn->error]);
    }
}

// Функция для входа пользователя
function login($conn) {
    // Получаем данные из запроса
    $data = json_decode(file_get_contents('php://input'), true);
    
    // Проверяем наличие необходимых полей
    if (!isset($data['username']) || !isset($data['password'])) {
        echo json_encode(['error' => 'Username and password are required']);
        return;
    }
    
    $username = trim($data['username']);
    $password = $data['password'];
    
    // Ищем пользователя в базе данных
    $stmt = $conn->prepare("SELECT id, username, password, is_admin, is_super_admin, is_premium, is_blocked, avatar FROM users WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode(['error' => 'Invalid username or password']);
        return;
    }
    
    $user = $result->fetch_assoc();
    
    // Проверяем пароль
    if (!password_verify($password, $user['password'])) {
        echo json_encode(['error' => 'Invalid username or password']);
        return;
    }
    
    // Проверяем, не заблокирован ли пользователь
    if ($user['is_blocked']) {
        echo json_encode(['error' => 'Your account is blocked']);
        return;
    }
    
    // Обновляем время последнего входа
    $stmt = $conn->prepare("UPDATE users SET last_login = NOW() WHERE id = ?");
    $stmt->bind_param("s", $user['id']);
    $stmt->execute();
    
    // Создаем сессию для пользователя
    $_SESSION['user_id'] = $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['is_admin'] = $user['is_admin'];
    $_SESSION['is_super_admin'] = $user['is_super_admin'];
    $_SESSION['is_premium'] = $user['is_premium'];
    
    // Возвращаем данные пользователя
    echo json_encode([
        'user' => [
            'id' => $user['id'],
            'username' => $user['username'],
            'is_admin' => (bool)$user['is_admin'],
            'is_super_admin' => (bool)$user['is_super_admin'],
            'is_premium' => (bool)$user['is_premium'],
            'is_blocked' => (bool)$user['is_blocked'],
            'avatar' => $user['avatar']
        ]
    ]);
}

// Функция для выхода пользователя
function logout() {
    // Удаляем все данные сессии
    session_unset();
    session_destroy();
    
    echo json_encode(['success' => true]);
}

// Функция для проверки авторизации
function checkAuth() {
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['error' => 'Not authenticated']);
        return;
    }
    
    echo json_encode([
        'user' => [
            'id' => $_SESSION['user_id'],
            'username' => $_SESSION['username'],
            'is_admin' => (bool)$_SESSION['is_admin'],
            'is_super_admin' => (bool)$_SESSION['is_super_admin'],
            'is_premium' => (bool)$_SESSION['is_premium']
        ]
    ]);
}

// Функция для проверки доступности имени пользователя
function checkUsername($conn) {
    // Получаем данные из запроса
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['username'])) {
        echo json_encode(['error' => 'Username is required']);
        return;
    }
    
    $username = trim($data['username']);
    
    // Проверяем, существует ли уже пользователь с таким именем
    $stmt = $conn->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();
    
    echo json_encode(['available' => $result->num_rows === 0]);
}

// Функция для добавления администратора (только для главного администратора)
function addAdmin($conn) {
    // Проверяем, авторизован ли пользователь
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['error' => 'Authentication required']);
        return;
    }
    
    // Проверяем, является ли пользователь главным администратором
    if (!isSuperAdmin($conn, $_SESSION['user_id'])) {
        echo json_encode(['error' => 'Super admin rights required']);
        return;
    }
    
    // Получаем данные из запроса
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['username'])) {
        echo json_encode(['error' => 'Username is required']);
        return;
    }
    
    $username = trim($data['username']);
    
    // Ищем пользователя по имени
    $stmt = $conn->prepare("SELECT id, is_admin FROM users WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode(['error' => 'User not found']);
        return;
    }
    
    $user = $result->fetch_assoc();
    
    // Проверяем, не является ли пользователь уже администратором
    if ((int)$user['is_admin'] === 1) {
        echo json_encode(['error' => 'User is already an admin']);
        return;
    }
    
    // Назначаем пользователя администратором
    $stmt = $conn->prepare("UPDATE users SET is_admin = 1 WHERE id = ?");
    $stmt->bind_param("s", $user['id']);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['error' => 'Error updating user: ' . $conn->error]);
    }
}

// Функция для удаления прав администратора (только для главного администратора)
function removeAdmin($conn) {
    // Проверяем, авторизован ли пользователь
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['error' => 'Authentication required']);
        return;
    }
    
    // Проверяем, является ли пользователь главным администратором
    if (!isSuperAdmin($conn, $_SESSION['user_id'])) {
        echo json_encode(['error' => 'Super admin rights required']);
        return;
    }
    
    // Получаем данные из запроса
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['username'])) {
        echo json_encode(['error' => 'Username is required']);
        return;
    }
    
    $username = trim($data['username']);
    
    // Ищем пользователя по имени
    $stmt = $conn->prepare("SELECT id, is_admin, is_super_admin FROM users WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode(['error' => 'User not found']);
        return;
    }
    
    $user = $result->fetch_assoc();
    
    // Проверяем, не является ли пользователь главным администратором
    if ((int)$user['is_super_admin'] === 1) {
        echo json_encode(['error' => 'Cannot remove admin rights from super admin']);
        return;
    }
    
    // Проверяем, является ли пользователь администратором
    if ((int)$user['is_admin'] === 0) {
        echo json_encode(['error' => 'User is not an admin']);
        return;
    }
    
    // Удаляем права администратора
    $stmt = $conn->prepare("UPDATE users SET is_admin = 0 WHERE id = ?");
    $stmt->bind_param("s", $user['id']);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['error' => 'Error updating user: ' . $conn->error]);
    }
}
?>
