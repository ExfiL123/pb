<?php
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

// Проверка прав администратора
function checkAdminRights() {
    if (!isset($_SESSION['user_id']) || !isset($_SESSION['is_admin']) || (int)$_SESSION['is_admin'] !== 1) {
        echo json_encode(['error' => 'Admin rights required']);
        exit;
    }
    return true;
}

// Получение данных запроса
$data = json_decode(file_get_contents('php://input'), true);
$action = isset($_GET['action']) ? $_GET['action'] : '';

// Обработка различных действий
switch ($action) {
    case 'get':
        checkAdminRights();
        getUsers($conn, $data);
        break;
    case 'block':
        checkAdminRights();
        blockUser($conn, $data);
        break;
    case 'unblock':
        checkAdminRights();
        unblockUser($conn, $data);
        break;
    case 'search':
        checkAdminRights();
        searchUsers($conn, $data);
        break;
    case 'get_top_players':
        getTopPlayers($conn, $data);
        break;
    default:
        echo json_encode(['error' => 'Unknown action']);
        break;
}

// Функция для получения списка пользователей с пагинацией
function getUsers($conn, $data) {
    $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 10;
    $offset = ($page - 1) * $limit;
    
    // Получаем общее количество пользователей
    $result = $conn->query("SELECT COUNT(*) as total FROM users");
    $totalUsers = $result->fetch_assoc()['total'];
    
    // Получаем пользователей с пагинацией
    $stmt = $conn->prepare("
        SELECT id, username, is_admin, is_super_admin, is_premium, is_blocked, avatar, last_login 
        FROM users 
        ORDER BY id DESC 
        LIMIT ? OFFSET ?
    ");
    $stmt->bind_param("ii", $limit, $offset);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = $row;
    }
    
    echo json_encode([
        'users' => $users,
        'totalUsers' => $totalUsers,
        'currentPage' => $page,
        'totalPages' => ceil($totalUsers / $limit)
    ]);
}

// Функция для блокировки пользователя
function blockUser($conn, $data) {
    $userId = $data['userId'] ?? '';
    
    if (empty($userId)) {
        echo json_encode(['error' => 'User ID is required']);
        return;
    }
    
    // Проверяем, не пытается ли админ заблокировать себя
    if ($userId == $_SESSION['user_id']) {
        echo json_encode(['error' => 'You cannot block yourself']);
        return;
    }
    
    // Проверяем, не пытается ли админ заблокировать супер-админа
    $stmt = $conn->prepare("SELECT is_super_admin FROM users WHERE id = ?");
    $stmt->bind_param("s", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode(['error' => 'User not found']);
        return;
    }
    
    $user = $result->fetch_assoc();
    if ((int)$user['is_super_admin'] === 1 && (int)$_SESSION['is_super_admin'] !== 1) {
        echo json_encode(['error' => 'You cannot block a super admin']);
        return;
    }
    
    // Блокируем пользователя
    $stmt = $conn->prepare("UPDATE users SET is_blocked = 1, blocked_at = NOW() WHERE id = ?");
    $stmt->bind_param("s", $userId);
    
    if ($stmt->execute()) {
        // Логируем блокировку
        $adminId = $_SESSION['user_id'];
        $stmt = $conn->prepare("INSERT INTO user_blocks (user_id, admin_id, reason, blocked_at) VALUES (?, ?, 'Blocked by admin', NOW())");
        $stmt->bind_param("ss", $userId, $adminId);
        $stmt->execute();
        
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['error' => 'Error blocking user: ' . $conn->error]);
    }
}

// Функция для разблокировки пользователя
function unblockUser($conn, $data) {
    $userId = $data['userId'] ?? '';
    
    if (empty($userId)) {
        echo json_encode(['error' => 'User ID is required']);
        return;
    }
    
    // Разблокируем пользователя
    $stmt = $conn->prepare("UPDATE users SET is_blocked = 0 WHERE id = ?");
    $stmt->bind_param("s", $userId);
    
    if ($stmt->execute()) {
        // Логируем разблокировку
        $adminId = $_SESSION['user_id'];
        $stmt = $conn->prepare("INSERT INTO user_blocks (user_id, admin_id, reason, unblocked_at) VALUES (?, ?, 'Unblocked by admin', NOW())");
        $stmt->bind_param("ss", $userId, $adminId);
        $stmt->execute();
        
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['error' => 'Error unblocking user: ' . $conn->error]);
    }
}

// Функция для поиска пользователей
function searchUsers($conn, $data) {
    $query = $data['query'] ?? '';
    
    if (empty($query)) {
        echo json_encode(['error' => 'Search query is required']);
        return;
    }
    
    // Поиск пользователей по имени
    $searchQuery = "%$query%";
    $stmt = $conn->prepare("
        SELECT id, username, is_admin, is_super_admin, is_premium, is_blocked, avatar 
        FROM users 
        WHERE username LIKE ? 
        ORDER BY username 
        LIMIT 10
    ");
    $stmt->bind_param("s", $searchQuery);
    $stmt->execute();
    $result = $stmt->get_result();
    
    $users = [];
    while ($row = $result->fetch_assoc()) {
        $users[] = $row;
    }
    
    echo json_encode(['users' => $users]);
}

// Функция для получения топа игроков
function getTopPlayers($conn, $data) {
    $sortBy = $data['sortBy'] ?? 'pixels_placed';
    $limit = isset($data['limit']) ? (int)$data['limit'] : 20;
    
    // Проверяем, что sortBy имеет допустимое значение
    if (!in_array($sortBy, ['pixels_placed', 'total_time'])) {
        $sortBy = 'pixels_placed';
    }
    
    try {
        // Проверяем, существует ли колонка total_seconds в таблице user_stats
        $columnCheckResult = $conn->query("SHOW COLUMNS FROM user_stats LIKE 'total_seconds'");
        $hasSecondsColumn = $columnCheckResult->num_rows > 0;
        
        // Формируем SQL запрос в зависимости от наличия колонки total_seconds
        if ($hasSecondsColumn) {
            $sql = "
                SELECT 
                    u.id,
                    u.username, 
                    u.is_admin,
                    u.is_super_admin,
                    u.is_premium,
                    s.pixels_placed, 
                    s.total_time,
                    s.total_seconds
                FROM 
                    user_stats s 
                JOIN 
                    users u ON s.user_id = u.id 
                WHERE 
                    u.is_blocked = 0 
                ORDER BY 
                    s.$sortBy DESC 
                LIMIT ?
            ";
        } else {
            $sql = "
                SELECT 
                    u.id,
                    u.username, 
                    u.is_admin,
                    u.is_super_admin,
                    u.is_premium,
                    s.pixels_placed, 
                    s.total_time
                FROM 
                    user_stats s 
                JOIN 
                    users u ON s.user_id = u.id 
                WHERE 
                    u.is_blocked = 0 
                ORDER BY 
                    s.$sortBy DESC 
                LIMIT ?
            ";
        }
        
        $stmt = $conn->prepare($sql);
        $stmt->bind_param("i", $limit);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $players = [];
        while ($row = $result->fetch_assoc()) {
            $player = [
                'id' => $row['id'],
                'username' => $row['username'],
                'is_admin' => (bool)$row['is_admin'],
                'is_super_admin' => (bool)$row['is_super_admin'],
                'is_premium' => (bool)$row['is_premium'],
                'pixels_placed' => (int)$row['pixels_placed'],
                'total_time' => (int)$row['total_time'],
                'role' => ''
            ];
            
            // Определяем роль пользователя для отображения
            if ((bool)$row['is_super_admin']) {
                $player['role'] = 'superadm';
                $player['role_color'] = 'red';
            } elseif ((bool)$row['is_admin']) {
                $player['role'] = 'admin';
                $player['role_color'] = 'blue';
            } elseif ((bool)$row['is_premium']) {
                $player['role'] = 'prem';
                $player['role_color'] = 'orange';
            }
            
            // Добавляем total_seconds только если колонка существует
            if ($hasSecondsColumn && isset($row['total_seconds'])) {
                $player['total_seconds'] = (int)$row['total_seconds'];
            }
            
            $players[] = $player;
        }
        
        echo json_encode(['players' => $players]);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Error getting top players: ' . $e->getMessage()]);
    }
}
?>
