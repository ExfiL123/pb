<?php
// setup.php - Скрипт для создания необходимых таблиц в базе данных
require_once 'db-config.php';

// Создаем таблицу пользователей, если она не существует
$conn->query("
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(30) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    registration_ip VARCHAR(45) NOT NULL,
    is_admin TINYINT(1) DEFAULT 0,
    is_super_admin TINYINT(1) DEFAULT 0,
    is_blocked TINYINT(1) DEFAULT 0,
    avatar VARCHAR(255) DEFAULT NULL,
    created_at DATETIME NOT NULL,
    last_login DATETIME DEFAULT NULL
)
");

// Создаем таблицу пикселей, если она не существует
$conn->query("
CREATE TABLE IF NOT EXISTS pixels (
    x INT NOT NULL,
    y INT NOT NULL,
    color VARCHAR(20) NOT NULL,
    user_id INT NOT NULL,
    placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (x, y),
    FOREIGN KEY (user_id) REFERENCES users(id)
)
");

// Создаем таблицу истории холста, если она не существует
$conn->query("
CREATE TABLE IF NOT EXISTS canvas_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    x INT NOT NULL,
    y INT NOT NULL,
    color VARCHAR(20) DEFAULT NULL,
    previous_color VARCHAR(20) DEFAULT NULL,
    user_id INT NOT NULL,
    action_type ENUM('place', 'erase', 'admin_clear') NOT NULL,
    action_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
)
");

// Создаем таблицу настроек холста, если она не существует
$conn->query("
CREATE TABLE IF NOT EXISTS canvas_settings (
    id INT PRIMARY KEY DEFAULT 1,
    is_locked TINYINT(1) DEFAULT 0
)
");

// Создаем таблицу статистики пользователей, если она не существует
$conn->query("
CREATE TABLE IF NOT EXISTS user_stats (
    user_id INT PRIMARY KEY,
    coins INT DEFAULT 0,
    pixels_placed INT DEFAULT 0,
    total_time INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
)
");

// Создаем таблицу истории магазина, если она не существует
$conn->query("
CREATE TABLE IF NOT EXISTS shop_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    item_id VARCHAR(50) NOT NULL,
    price INT NOT NULL,
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
)
");

// Проверяем, есть ли главный администратор
$result = $conn->query("SELECT id FROM users WHERE is_super_admin = 1 LIMIT 1");

if ($result->num_rows === 0) {
    // Создаем главного администратора, если его нет
    $username = 'superadmin';
    $password = password_hash('admin123', PASSWORD_DEFAULT);
    $ip = '127.0.0.1';
    
    $conn->query("
    INSERT INTO users (username, password, registration_ip, is_admin, is_super_admin, created_at)
    VALUES ('$username', '$password', '$ip', 1, 1, NOW())
    ");
    
    $user_id = $conn->insert_id;
    
    // Создаем запись в таблице статистики
    $conn->query("
    INSERT INTO user_stats (user_id, coins, pixels_placed, total_time)
    VALUES ($user_id, 0, 0, 0)
    ");
    
    echo "Главный администратор создан. Логин: superadmin, Пароль: admin123";
} else {
    echo "Настройка завершена. Таблицы созданы или уже существуют.";
}

// Добавляем поле is_super_admin, если его нет
$result = $conn->query("SHOW COLUMNS FROM users LIKE 'is_super_admin'");
if ($result->num_rows === 0) {
    $conn->query("ALTER TABLE users ADD COLUMN is_super_admin TINYINT(1) DEFAULT 0 AFTER is_admin");
    echo "Поле is_super_admin добавлено в таблицу users.";
}

$conn->close();
?>
