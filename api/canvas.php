<?php
require_once '../db-config.php';
session_start();

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
        if (!$_SESSION['is_admin']) {
            echo json_encode(['error' => 'Admin rights required']);
            exit;
        }
        clearPixels($conn, $data);
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
    $stmt = $conn->prepare("SELECT is_blocked FROM users WHERE id = ?");
    $stmt->bind_param("s", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();
    
    if ($user['is_blocked']) {
        echo json_encode(['error' => 'Your account is blocked']);
        return;
    }
    
    // Check if drawing is allowed at current time
    if (!isDrawingAllowed()) {
        echo json_encode(['error' => 'Drawing is only allowed from 06:00 to 23:59 MSK']);
        return;
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
?>