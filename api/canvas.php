<?php
require_once '../db-config.php';
session_start();

header('Content-Type: application/json');

// Получение данных запроса
$data = json_decode(file_get_contents('php://input'), true);
$action = isset($_GET['action']) ? $_GET['action'] : '';

// Проверка авторизации для некоторых действий
function checkAuth() {
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['error' => 'Требуется авторизация']);
        exit;
    }
    return $_SESSION['user_id'];
}

// Обработка различных действий
switch ($action) {
    case 'get':
        getCanvas($conn);
        break;
    case 'place':
        $user_id = checkAuth();
        placePixel($conn, $data, $user_id);
        break;
    case 'clear':
        $user_id = checkAuth();
        if (!$_SESSION['is_admin']) {
            echo json_encode(['error' => 'Требуются права администратора']);
            exit;
        }
        clearPixels($conn, $data);
        break;
    default:
        echo json_encode(['error' => 'Неизвестное действие']);
        break;
}

// Функция для получения холста
function getCanvas($conn) {
    $result = $conn->query("SELECT x, y, color FROM pixels");
    $pixels = [];
    
    while ($row = $result->fetch_assoc()) {
        $pixels[] = $row;
    }
    
    echo json_encode(['pixels' => $pixels]);
}

// Функция для размещения пикселя
function placePixel($conn, $data, $user_id) {
    $x = $data['x'] ?? null;
    $y = $data['y'] ?? null;
    $color = $data['color'] ?? null;
    
    if ($x === null || $y === null || $color === null) {
        echo json_encode(['error' => 'Необходимо указать x, y и color']);
        return;
    }
    
    // Проверка, заблокирован ли пользователь
    $stmt = $conn->prepare("SELECT is_blocked FROM users WHERE id = ?");
    $stmt->bind_param("s", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    
    if ($user['is_blocked']) {
        echo json_encode(['error' => 'Ваш аккаунт заблокирован']);
        return;
    }
    
    // Получение предыдущего цвета (если есть)
    $stmt = $conn->prepare("SELECT color FROM pixels WHERE x = ? AND y = ?");
    $stmt->bind_param("ii", $x, $y);
    $stmt->execute();
    $result = $stmt->get_result();
    $previous_color = null;
    
    if ($result->num_rows > 0) {
        $pixel = $result->fetch_assoc();
        $previous_color = $pixel['color'];
        
        // Обновление существующего пикселя
        $stmt = $conn->prepare("UPDATE pixels SET color = ?, user_id = ?, placed_at = CURRENT_TIMESTAMP WHERE x = ? AND y = ?");
        $stmt->bind_param("ssii", $color, $user_id, $x, $y);
    } else {
        // Создание нового пикселя
        $stmt = $conn->prepare("INSERT INTO pixels (x, y, color, user_id) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("iiss", $x, $y, $color, $user_id);
    }
    
    if ($stmt->execute()) {
        // Запись в историю
        $stmt = $conn->prepare("INSERT INTO canvas_history (x, y, color, previous_color, user_id, action_type) VALUES (?, ?, ?, ?, ?, 'place')");
        $stmt->bind_param("iisss", $x, $y, $color, $previous_color, $user_id);
        $stmt->execute();
        
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['error' => 'Ошибка при размещении пикселя: ' . $conn->error]);
    }
}

// Функция для очистки пикселей (только для админов)
function clearPixels($conn, $data) {
    $startX = $data['startX'] ?? null;
    $startY = $data['startY'] ?? null;
    $endX = $data['endX'] ?? null;
    $endY = $data['endY'] ?? null;
    
    if ($startX === null || $startY === null || $endX === null || $endY === null) {
        echo json_encode(['error' => 'Необходимо указать startX, startY, endX и endY']);
        return;
    }
    
    $user_id = $_SESSION['user_id'];
    
    // Получение пикселей перед удалением для истории
    $stmt = $conn->prepare("SELECT x, y, color FROM pixels WHERE x >= ? AND x <= ? AND y >= ? AND y <= ?");
    $stmt->bind_param("iiii", $startX, $endX, $startY, $endY);
    $stmt->execute();
    $result = $stmt->get_result();
    $pixels_to_delete = [];
    
    while ($row = $result->fetch_assoc()) {
        $pixels_to_delete[] = $row;
    }
    
    // Удаление пикселей
    $stmt = $conn->prepare("DELETE FROM pixels WHERE x >= ? AND x <= ? AND y >= ? AND y <= ?");
    $stmt->bind_param("iiii", $startX, $endX, $startY, $endY);
    
    if ($stmt->execute()) {
        // Запись в историю для каждого удаленного пикселя
        foreach ($pixels_to_delete as $pixel) {
            $stmt = $conn->prepare("INSERT INTO canvas_history (x, y, color, previous_color, user_id, action_type) VALUES (?, ?, NULL, ?, ?, 'admin_clear')");
            $stmt->bind_param("iiss", $pixel['x'], $pixel['y'], $pixel['color'], $user_id);
            $stmt->execute();
        }
        
        echo json_encode(['success' => true, 'count' => count($pixels_to_delete)]);
    } else {
        echo json_encode(['error' => 'Ошибка при очистке пикселей: ' . $conn->error]);
    }
}
?>
