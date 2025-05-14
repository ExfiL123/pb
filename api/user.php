<?php
// api/user.php
require_once '../db-config.php';
session_start();

header('Content-Type: application/json');

// Проверка авторизации
function checkAuth() {
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['error' => 'Authentication required']);
        exit;
    }
    return $_SESSION['user_id'];
}

// Получение данных запроса
$data = json_decode(file_get_contents('php://input'), true);
$action = isset($_GET['action']) ? $_GET['action'] : '';

// Обработка различных действий
switch ($action) {
    case 'get_stats':
        $user_id = checkAuth();
        getUserStats($conn, $user_id);
        break;
    case 'update_stats':
        $user_id = checkAuth();
        updateUserStats($conn, $user_id, $data);
        break;
    default:
        echo json_encode(['error' => 'Unknown action']);
        break;
}

// Функция для получения статистики пользователя
function getUserStats($conn, $user_id) {
    // Проверяем, существует ли запись в таблице user_stats
    $stmt = $conn->prepare("SELECT * FROM user_stats WHERE user_id = ?");
    $stmt->bind_param("s", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        // Если записи нет, создаем новую
        $stmt = $conn->prepare("INSERT INTO user_stats (user_id, coins, pixels_placed, total_time, total_seconds) VALUES (?, 0, 0, 0, 0)");
        $stmt->bind_param("s", $user_id);
        $stmt->execute();
        
        echo json_encode(['stats' => [
            'coins' => 0,
            'pixels_placed' => 0,
            'total_time' => 0,
            'total_seconds' => 0
        ]]);
        return;
    }
    
    $stats = $result->fetch_assoc();
    
    echo json_encode(['stats' => [
        'coins' => (int)$stats['coins'],
        'pixels_placed' => (int)$stats['pixels_placed'],
        'total_time' => (int)$stats['total_time'],
        'total_seconds' => (int)$stats['total_seconds']
    ]]);
}

// Функция для обновления статистики пользователя
function updateUserStats($conn, $user_id, $data) {
    // Проверяем, существует ли запись в таблице user_stats
    $stmt = $conn->prepare("SELECT * FROM user_stats WHERE user_id = ?");
    $stmt->bind_param("s", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        // Если записи нет, создаем новую
        $coins = isset($data['coins']) ? (int)$data['coins'] : 0;
        $pixels_placed = isset($data['pixels_placed']) ? (int)$data['pixels_placed'] : 0;
        $total_time = isset($data['total_time']) ? (int)$data['total_time'] : 0;
        $total_seconds = isset($data['total_seconds']) ? (int)$data['total_seconds'] : 0;
        
        $stmt = $conn->prepare("INSERT INTO user_stats (user_id, coins, pixels_placed, total_time, total_seconds) VALUES (?, ?, ?, ?, ?)");
        $stmt->bind_param("siiii", $user_id, $coins, $pixels_placed, $total_time, $total_seconds);
    } else {
        // Если запись есть, обновляем ее
        $stats = $result->fetch_assoc();
        
        $coins = isset($data['coins']) ? (int)$data['coins'] : (int)$stats['coins'];
        $pixels_placed = isset($data['pixels_placed']) ? (int)$data['pixels_placed'] : (int)$stats['pixels_placed'];
        $total_time = isset($data['total_time']) ? (int)$data['total_time'] : (int)$stats['total_time'];
        $total_seconds = isset($data['total_seconds']) ? (int)$data['total_seconds'] : (int)$stats['total_seconds'];
        
        $stmt = $conn->prepare("UPDATE user_stats SET coins = ?, pixels_placed = ?, total_time = ?, total_seconds = ? WHERE user_id = ?");
        $stmt->bind_param("iiiis", $coins, $pixels_placed, $total_time, $total_seconds, $user_id);
    }
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['error' => 'Error updating user stats: ' . $conn->error]);
    }
}
?>
