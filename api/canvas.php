<?php
require_once '../db-config.php';
session_start();

// Get canvas settings
function getCanvasSettings($conn) {
    $result = $conn->query("SELECT * FROM canvas_settings WHERE id = 1");
    if ($result->num_rows > 0) {
        return $result->fetch_assoc();
    }
    
    // If no settings exist, create default settings
    $conn->query("INSERT INTO canvas_settings (id, is_locked) VALUES (1, 0)");
    return ['id' => 1, 'is_locked' => 0];
}

header('Content-Type: application/json');

// Get request data
$data = json_decode(file_get_contents('php://input'), true);
$action = isset($_GET['action']) ? $_GET['action'] : '';

// Check auth for certain actions
function checkAuth() {
    if (!isset($_SESSION['user_id'])) {
        echo json_encode(['error' => 'Authentication required']);
        exit;
    }
    return $_SESSION['user_id'];
}

// Check if current time is within allowed drawing hours (06:00 - 23:59 MSK)
function isDrawingAllowed() {
    // Админы всегда могут рисовать
    if (isset($_SESSION['is_admin']) && (int)$_SESSION['is_admin'] === 1) {
        return true;
    }
    
    // Set timezone to Moscow
    date_default_timezone_set('Europe/Moscow');
    $current_hour = (int)date('H');
    $current_minute = (int)date('i');
    
    // Convert to minutes for easier comparison
    $current_time_minutes = $current_hour * 60 + $current_minute;
    $start_time_minutes = 6 * 60; // 06:00
    $end_time_minutes = 23 * 60 + 59; // 23:59
    
    return ($current_time_minutes >= $start_time_minutes && $current_time_minutes <= $end_time_minutes);
}

// Функция для проверки прав администратора
function checkAdminRights() {
    if (!isset($_SESSION['user_id']) || !isset($_SESSION['is_admin']) || (int)$_SESSION['is_admin'] !== 1) {
        echo json_encode(['error' => 'Admin rights required']);
        exit;
    }
    return true;
}

// Process different actions
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
        // Используем новую функцию проверки прав администратора
        checkAdminRights();
        clearPixels($conn, $data);
        break;
    case 'erase':
        $user_id = checkAuth();
        erasePixel($conn, $data, $user_id);
        break;
    case 'get_settings':
        getSettings($conn);
        break;
    case 'update_settings':
        $user_id = checkAuth();
        // Используем новую функцию проверки прав администратора
        checkAdminRights();
        updateSettings($conn, $data);
        break;
    default:
        echo json_encode(['error' => 'Unknown action']);
        break;
}

// Function to get canvas
function getCanvas($conn) {
    $result = $conn->query("SELECT x, y, color FROM pixels");
    $pixels = [];
    
    while ($row = $result->fetch_assoc()) {
        $pixels[] = $row;
    }
    
    echo json_encode(['pixels' => $pixels]);
}

// Function to place pixel
function placePixel($conn, $data, $user_id) {
    $x = $data['x'] ?? null;
    $y = $data['y'] ?? null;
    $color = $data['color'] ?? null;
    
    if ($x === null || $y === null || $color === null) {
        echo json_encode(['error' => 'Must specify x, y and color']);
        return;
    }
    
    // Check if user is blocked
    $stmt = $conn->prepare("SELECT is_blocked, is_admin FROM users WHERE id = ?");
    $stmt->bind_param("s", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    
    // Преобразуем значения в целые числа для корректного сравнения
    $is_blocked = (int)$user['is_blocked'];
    $is_admin = (int)$user['is_admin'];
    
    if ($is_blocked === 1) {
        echo json_encode(['error' => 'Your account is blocked']);
        return;
    }
    
    // Check if canvas is locked (only for non-admins)
    if ($is_admin !== 1) {
        $settings = getCanvasSettings($conn);
        if ((int)$settings['is_locked'] === 1) {
            echo json_encode(['error' => 'Canvas is currently locked by an administrator']);
            return;
        }
        
        // Check if drawing is allowed at current time
        if (!isDrawingAllowed()) {
            echo json_encode(['error' => 'Drawing is only allowed from 06:00 to 23:59 MSK']);
            return;
        }
        
        // Check cooldown for regular users
        $stmt = $conn->prepare("SELECT MAX(placed_at) as last_action FROM pixels WHERE user_id = ?");
        $stmt->bind_param("s", $user_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $lastAction = $result->fetch_assoc()['last_action'];
        
        if ($lastAction) {
            $lastActionTime = strtotime($lastAction);
            $currentTime = time();
            $timeDiff = $currentTime - $lastActionTime;
            
            if ($timeDiff < 2) { // 2 seconds cooldown
                echo json_encode(['error' => 'Please wait ' . (2 - $timeDiff) . ' seconds before placing another pixel']);
                return;
            }
        }
    }
    
    // Get previous color (if exists)
    $stmt = $conn->prepare("SELECT color FROM pixels WHERE x = ? AND y = ?");
    $stmt->bind_param("ii", $x, $y);
    $stmt->execute();
    $result = $stmt->get_result();
    $previous_color = null;
    
    if ($result->num_rows > 0) {
        $pixel = $result->fetch_assoc();
        $previous_color = $pixel['color'];
        
        // Update existing pixel
        $stmt = $conn->prepare("UPDATE pixels SET color = ?, user_id = ?, placed_at = CURRENT_TIMESTAMP WHERE x = ? AND y = ?");
        $stmt->bind_param("ssii", $color, $user_id, $x, $y);
    } else {
        // Create new pixel
        $stmt = $conn->prepare("INSERT INTO pixels (x, y, color, user_id) VALUES (?, ?, ?, ?)");
        $stmt->bind_param("iiss", $x, $y, $color, $user_id);
    }
    
    if ($stmt->execute()) {
        // Record in history
        $stmt = $conn->prepare("INSERT INTO canvas_history (x, y, color, previous_color, user_id, action_type) VALUES (?, ?, ?, ?, ?, 'place')");
        $stmt->bind_param("iisss", $x, $y, $color, $previous_color, $user_id);
        $stmt->execute();
        
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['error' => 'Error placing pixel: ' . $conn->error]);
    }
}

// Function to clear pixels (admin only)
function clearPixels($conn, $data) {
    $startX = $data['startX'] ?? null;
    $startY = $data['startY'] ?? null;
    $endX = $data['endX'] ?? null;
    $endY = $data['endY'] ?? null;
    
    if ($startX === null || $startY === null || $endX === null || $endY === null) {
        echo json_encode(['error' => 'Must specify startX, startY, endX and endY']);
        return;
    }
    
    $user_id = $_SESSION['user_id'];
    
    // Get pixels before deletion for history
    $stmt = $conn->prepare("SELECT x, y, color FROM pixels WHERE x >= ? AND x <= ? AND y >= ? AND y <= ?");
    $stmt->bind_param("iiii", $startX, $endX, $startY, $endY);
    $stmt->execute();
    $result = $stmt->get_result();
    $pixels_to_delete = [];
    
    while ($row = $result->fetch_assoc()) {
        $pixels_to_delete[] = $row;
    }
    
    // Delete pixels
    $stmt = $conn->prepare("DELETE FROM pixels WHERE x >= ? AND x <= ? AND y >= ? AND y <= ?");
    $stmt->bind_param("iiii", $startX, $endX, $startY, $endY);
    
    if ($stmt->execute()) {
        // Record in history for each deleted pixel
        foreach ($pixels_to_delete as $pixel) {
            $stmt = $conn->prepare("INSERT INTO canvas_history (x, y, color, previous_color, user_id, action_type) VALUES (?, ?, NULL, ?, ?, 'admin_clear')");
            $stmt->bind_param("iiss", $pixel['x'], $pixel['y'], $pixel['color'], $user_id);
            $stmt->execute();
        }
        
        echo json_encode(['success' => true, 'count' => count($pixels_to_delete)]);
    } else {
        echo json_encode(['error' => 'Error clearing pixels: ' . $conn->error]);
    }
}

// Function to erase a pixel
function erasePixel($conn, $data, $user_id) {
    $x = $data['x'] ?? null;
    $y = $data['y'] ?? null;
    
    if ($x === null || $y === null) {
        echo json_encode(['error' => 'Must specify x and y']);
        return;
    }
    
    // Check if user is blocked
    $stmt = $conn->prepare("SELECT is_blocked, is_admin FROM users WHERE id = ?");
    $stmt->bind_param("s", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    
    // Преобразуем значения в целые числа для корректного сравнения
    $is_blocked = (int)$user['is_blocked'];
    $is_admin = (int)$user['is_admin'];
    
    if ($is_blocked === 1) {
        echo json_encode(['error' => 'Your account is blocked']);
        return;
    }
    
    // Check if canvas is locked (only for non-admins)
    if ($is_admin !== 1) {
        $settings = getCanvasSettings($conn);
        if ((int)$settings['is_locked'] === 1) {
            echo json_encode(['error' => 'Canvas is currently locked by an administrator']);
            return;
        }
        
        // Check if drawing is allowed at current time
        if (!isDrawingAllowed()) {
            echo json_encode(['error' => 'Drawing is only allowed from 06:00 to 23:59 MSK']);
            return;
        }
        
        // Check cooldown for regular users
        $stmt = $conn->prepare("SELECT MAX(placed_at) as last_action FROM pixels WHERE user_id = ?");
        $stmt->bind_param("s", $user_id);
        $stmt->execute();
        $result = $stmt->get_result();
        $lastAction = $result->fetch_assoc()['last_action'];
        
        if ($lastAction) {
            $lastActionTime = strtotime($lastAction);
            $currentTime = time();
            $timeDiff = $currentTime - $lastActionTime;
            
            if ($timeDiff < 2) { // 2 seconds cooldown
                echo json_encode(['error' => 'Please wait ' . (2 - $timeDiff) . ' seconds before placing another pixel']);
                return;
            }
        }
    }
    
    // Get previous color (if exists)
    $stmt = $conn->prepare("SELECT color FROM pixels WHERE x = ? AND y = ?");
    $stmt->bind_param("ii", $x, $y);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode(['error' => 'No pixel found at this position']);
        return;
    }
    
    $pixel = $result->fetch_assoc();
    $previous_color = $pixel['color'];
    
    // Delete the pixel
    $stmt = $conn->prepare("DELETE FROM pixels WHERE x = ? AND y = ?");
    $stmt->bind_param("ii", $x, $y);
    
    if ($stmt->execute()) {
        // Record in history
        $stmt = $conn->prepare("INSERT INTO canvas_history (x, y, color, previous_color, user_id, action_type) VALUES (?, ?, NULL, ?, ?, 'erase')");
        $stmt->bind_param("iiss", $x, $y, $previous_color, $user_id);
        $stmt->execute();
        
        // Update last action time
        $stmt = $conn->prepare("INSERT INTO pixels (x, y, color, user_id, placed_at) VALUES (?, ?, 'erased', ?, NOW()) ON DUPLICATE KEY UPDATE placed_at = NOW()");
        $stmt->bind_param("iis", $x, $y, $user_id);
        $stmt->execute();
        
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['error' => 'Error erasing pixel: ' . $conn->error]);
    }
}

// Function to get canvas settings
function getSettings($conn) {
    $settings = getCanvasSettings($conn);
    echo json_encode(['settings' => $settings]);
}

// Function to update canvas settings
function updateSettings($conn, $data) {
    // Проверяем права администратора еще раз для надежности
    checkAdminRights();
    
    $is_locked = isset($data['is_locked']) ? (int)$data['is_locked'] : 0;
    
    $stmt = $conn->prepare("UPDATE canvas_settings SET is_locked = ? WHERE id = 1");
    $stmt->bind_param("i", $is_locked);
    
    if ($stmt->execute()) {
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['error' => 'Error updating settings: ' . $conn->error]);
    }
}
?>
