<?php

header('Content-Type: application/json');
require_once('../config/db.php');

// Function to handle user registration (example)
function registerUser($conn, $data) {
    // Basic validation
    if (!isset($data['username']) || !isset($data['password'])) {
        echo json_encode(['error' => 'Username and password are required']);
        return;
    }

    $username = $data['username'];
    $password = password_hash($data['password'], PASSWORD_DEFAULT); // Hash the password

    // Check if username already exists
    $stmt = $conn->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->bind_param("s", $username);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        echo json_encode(['error' => 'Username already exists']);
        return;
    }

    // Insert the new user
    $stmt = $conn->prepare("INSERT INTO users (username, password) VALUES (?, ?)");
    $stmt->bind_param("ss", $username, $password);

    if ($stmt->execute()) {
        echo json_encode(['message' => 'User registered successfully']);
    } else {
        echo json_encode(['error' => 'Registration failed']);
    }
}

function getTopPlayers($conn, $data) {
    $sortBy = $data['sortBy'] ?? 'pixels_placed';
    $limit = isset($data['limit']) ? (int)$data['limit'] : 20;
    
    // Проверяем, что sortBy имеет допустимое значение
    if (!in_array($sortBy, ['pixels_placed', 'total_time'])) {
        $sortBy = 'pixels_placed';
    }
    
    try {
        $stmt = $conn->prepare("
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
        ");
        
        $stmt->bind_param("i", $limit);
        $stmt->execute();
        $result = $stmt->get_result();
        
        $players = [];
        while ($row = $result->fetch_assoc()) {
            $players[] = [
                'id' => $row['id'],
                'username' => $row['username'],
                'is_admin' => (bool)$row['is_admin'],
                'is_super_admin' => (bool)$row['is_super_admin'],
                'is_premium' => (bool)$row['is_premium'],
                'pixels_placed' => (int)$row['pixels_placed'],
                'total_time' => (int)$row['total_time'],
                'total_seconds' => (int)$row['total_seconds']
            ];
        }
        
        echo json_encode(['players' => $players]);
    } catch (Exception $e) {
        echo json_encode(['error' => 'Error getting top players: ' . $e->getMessage()]);
    }
}


// Main API logic
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_GET['action'] ?? '';
    $data = json_decode(file_get_contents("php://input"), true);

    switch ($action) {
        case 'register':
            registerUser($conn, $data);
            break;
        case 'top_players':
            getTopPlayers($conn, $data);
            break;
        default:
            echo json_encode(['error' => 'Invalid action']);
    }
} else {
    echo json_encode(['error' => 'Invalid request method']);
}

$conn->close();

?>
