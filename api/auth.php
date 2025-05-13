<?php
require_once '../db-config.php';
session_start();

header('Content-Type: application/json');

// Функция для генерации уникального ID
function generateUUID() {
    return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

// Получение данных запроса
$data = json_decode(file_get_contents('php://input'), true);
$action = isset($_GET['action']) ? $_GET['action'] : '';

// Обработка различных действий
switch ($action) {
    case 'logout':
        logout();
        break;
    case 'check':
        checkAuth();
        break;
    default:
        echo json_encode(['error' => 'Неизвестное действие']);
        break;
}

// Функция для выхода
function logout() {
    session_destroy();
    echo json_encode(['success' => true]);
}

// Функция для проверки авторизации
function checkAuth() {
    if (isset($_SESSION['user_id'])) {
        echo json_encode([
            'user' => [
                'id' => $_SESSION['user_id'],
                'username' => $_SESSION['username'],
                'is_admin' => $_SESSION['is_admin'],
                'vk_id' => $_SESSION['vk_id'] ?? null,
                'avatar' => $_SESSION['avatar'] ?? null
            ]
        ]);
    } else {
        echo json_encode(['user' => null]);
    }
}
?>
