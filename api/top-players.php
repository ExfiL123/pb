<?php
require_once '../db-config.php';
session_start();

header('Content-Type: application/json');

// Получаем данные запроса
$sortBy = isset($_GET['sortBy']) ? $_GET['sortBy'] : 'pixels_placed';

// Проверяем, что sortBy имеет допустимое значение
if (!in_array($sortBy, ['pixels_placed', 'total_time'])) {
    $sortBy = 'pixels_placed';
}

$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;

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
            'total_time' => (int)$row['total_time']
        ];
        
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
?>
