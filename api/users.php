<?php
require_once '../db-config.php';
session_start();

header('Content-Type: application/json');

// Проверка прав администратора
if (!isset($_SESSION['user_id']) || !$_SESSION['is_admin']) {
    echo json_encode(['error' => 'Требуются права администратора']);
    exit;
}

// Получение данных запроса
$data = json_decode(file_get_contents('php://input'), true);
$action = isset($_GET['action']) ? $_GET['action'] : '';

// Обработка различных действий
switch ($action) {
    case 'get':
        getUsers($conn);
        break;
    case 'block':
        blockUser($conn, $data);
        break;
    case 'unblock':
        unblockUser($conn, $data);
        break;
    default:
        echo json_encode(['error' => 'Неизвестное действие']);
        break;
}

// Функция для получения списка пользователей
function getUsers($conn) {
    $result = $conn->query("SELECT id, username, vk_id, avatar, is_admin, is_blocked FROM users");
    $users = [];
    
    while ($row = $result->fetch_assoc()) {
        $users[] = $row;
    }
    
    echo json_encode(['users' => $users]);
}

// Функция для блокировки пользователя
function blockUser($conn, $data) {
    $userId = $data['userId'] ?? '';
    
    if (empty($userId)) {
        echo json_encode(['error' => 'Необходимо указать ID пользователя']);
        return;
    }
    
    // Проверка, не пытается ли админ заблокировать сам себя
    if ($userId === $_SESSION['user_id']) {
        echo json_encode(['error' => 'Вы не можете заблокировать сами себя']);
        return;
    }
    
    $stmt = $conn->prepare("UPDATE users SET is_blocked = 1 WHERE id = ?");
    $stmt->bind_param("s", $userId);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['error' => 'Ошибка при блокировке пользователя: ' . $conn->error]);
    }
}

// Функция для разблокировки пользователя
function unblockUser($conn, $data) {
    $userId = $data['userId'] ?? '';
    
    if (empty($userId)) {
        echo json_encode(['error' => 'Необходимо указать ID пользователя']);
        return;
    }
    
    $stmt = $conn->prepare("UPDATE users SET is_blocked = 0 WHERE id = ?");
    $stmt->bind_param("s", $userId);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['error' => 'Ошибка при разблокировке пользователя: ' . $conn->error]);
    }
}
?>
