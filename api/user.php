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
    case 'check_premium':
        $user_id = checkAuth();
        checkPremiumStatus($conn, $user_id);
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
    
    // Проверяем, существует ли колонка total_seconds
    $hasSecondsColumn = isset($stats['total_seconds']);
    
    $responseStats = [
        'coins' => (int)$stats['coins'],
        'pixels_placed' => (int)$stats['pixels_placed'],
        'total_time' => (int)$stats['total_time']
    ];
    
    // Добавляем total_seconds только если колонка существует
    if ($hasSecondsColumn) {
        $responseStats['total_seconds'] = (int)$stats['total_seconds'];
    }
    
    echo json_encode(['stats' => $responseStats]);
}

// Функция для обновления статистики пользователя
function updateUserStats($conn, $user_id, $data) {
    // Проверяем, существует ли запись в таблице user_stats
    $stmt = $conn->prepare("SELECT * FROM user_stats WHERE user_id = ?");
    $stmt->bind_param("s", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    // Проверяем, существует ли колонка total_seconds
    $columnCheckResult = $conn->query("SHOW COLUMNS FROM user_stats LIKE 'total_seconds'");
    $hasSecondsColumn = $columnCheckResult->num_rows > 0;
    
    if ($result->num_rows === 0) {
        // Если записи нет, создаем новую
        $coins = isset($data['coins']) ? (int)$data['coins'] : 0;
        $pixels_placed = isset($data['pixels_placed']) ? (int)$data['pixels_placed'] : 0;
        $total_time = isset($data['total_time']) ? (int)$data['total_time'] : 0;
        
        if ($hasSecondsColumn) {
            $total_seconds = isset($data['total_seconds']) ? (int)$data['total_seconds'] : 0;
            $stmt = $conn->prepare("INSERT INTO user_stats (user_id, coins, pixels_placed, total_time, total_seconds) VALUES (?, ?, ?, ?, ?)");
            $stmt->bind_param("siiii", $user_id, $coins, $pixels_placed, $total_time, $total_seconds);
        } else {
            $stmt = $conn->prepare("INSERT INTO user_stats (user_id, coins, pixels_placed, total_time) VALUES (?, ?, ?, ?)");
            $stmt->bind_param("siii", $user_id, $coins, $pixels_placed, $total_time);
        }
    } else {
        // Если запись есть, обновляем ее
        $stats = $result->fetch_assoc();
        
        $coins = isset($data['coins']) ? (int)$data['coins'] : (int)$stats['coins'];
        $pixels_placed = isset($data['pixels_placed']) ? (int)$data['pixels_placed'] : (int)$stats['pixels_placed'];
        $total_time = isset($data['total_time']) ? (int)$data['total_time'] : (int)$stats['total_time'];
        
        if ($hasSecondsColumn) {
            $total_seconds = isset($data['total_seconds']) ? (int)$data['total_seconds'] : (int)($stats['total_seconds'] ?? 0);
            $stmt = $conn->prepare("UPDATE user_stats SET coins = ?, pixels_placed = ?, total_time = ?, total_seconds = ? WHERE user_id = ?");
            $stmt->bind_param("iiiis", $coins, $pixels_placed, $total_time, $total_seconds, $user_id);
        } else {
            $stmt = $conn->prepare("UPDATE user_stats SET coins = ?, pixels_placed = ?, total_time = ? WHERE user_id = ?");
            $stmt->bind_param("iiis", $coins, $pixels_placed, $total_time, $user_id);
        }
    }
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['error' => 'Error updating user stats: ' . $conn->error]);
    }
}

// Функция для проверки статуса премиума
function checkPremiumStatus($conn, $user_id) {
    // Проверяем, существует ли таблица user_premium
    $tableCheckResult = $conn->query("SHOW TABLES LIKE 'user_premium'");
    
    if ($tableCheckResult->num_rows === 0) {
        echo json_encode(['is_premium' => false]);
        return;
    }
    
    // Проверяем, есть ли активная премиум-подписка
    $stmt = $conn->prepare("
        SELECT * FROM user_premium 
        WHERE user_id = ? AND end_date > NOW() 
        ORDER BY end_date DESC 
        LIMIT 1
    ");
    $stmt->bind_param("s", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        // Если нет активной подписки, проверяем, нужно ли обновить статус пользователя
        $stmt = $conn->prepare("SELECT is_premium FROM users WHERE id = ?");
        $stmt->bind_param("s", $user_id);
        $stmt->execute();
        $userResult = $stmt->get_result();
        $user = $userResult->fetch_assoc();
        
        if ((int)$user['is_premium'] === 1) {
            // Если у пользователя установлен премиум, но нет активной подписки, снимаем статус
            $stmt = $conn->prepare("UPDATE users SET is_premium = 0 WHERE id = ?");
            $stmt->bind_param("s", $user_id);
            $stmt->execute();
            
            // Обновляем сессию
            $_SESSION['is_premium'] = false;
        }
        
        echo json_encode(['is_premium' => false]);
    } else {
        $premium = $result->fetch_assoc();
        $endDate = new DateTime($premium['end_date']);
        $now = new DateTime();
        $daysLeft = $now->diff($endDate)->days;
        
        echo json_encode([
            'is_premium' => true,
            'end_date' => $premium['end_date'],
            'days_left' => $daysLeft
        ]);
    }
}
?>
