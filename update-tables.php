<?php
// update-tables.php - Скрипт для обновления структуры таблиц в базе данных
require_once 'db-config.php';

// Добавляем поле is_premium в таблицу пользователей, если его нет
$result = $conn->query("SHOW COLUMNS FROM users LIKE 'is_premium'");
if ($result->num_rows === 0) {
  $conn->query("ALTER TABLE users ADD COLUMN is_premium TINYINT(1) DEFAULT 0 AFTER is_blocked");
  echo "Поле is_premium добавлено в таблицу users.<br>";
}

// Создаем таблицу премиум-подписок, если она не существует
$conn->query("
CREATE TABLE IF NOT EXISTS user_premium (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  start_date DATETIME NOT NULL,
  end_date DATETIME NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id)
)
");
echo "Таблица user_premium создана или уже существует.<br>";

// Проверяем существование таблицы shop_history
$result = $conn->query("SHOW TABLES LIKE 'shop_history'");
if ($result->num_rows === 0) {
  // Создаем таблицу shop_history, если она не существует
  $conn->query("
  CREATE TABLE shop_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    item_id VARCHAR(50) NOT NULL,
    item_type VARCHAR(50) NOT NULL,
    price INT NOT NULL,
    purchased_at DATETIME NOT NULL,
    expiry_date DATETIME DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )
  ");
  echo "Таблица shop_history создана.<br>";
} else {
  // Обновляем таблицу shop_history, добавляем поля item_type и expiry_date
  $result = $conn->query("SHOW COLUMNS FROM shop_history LIKE 'item_type'");
  if ($result->num_rows === 0) {
    $conn->query("ALTER TABLE shop_history ADD COLUMN item_type VARCHAR(50) NOT NULL AFTER item_id");
    echo "Поле item_type добавлено в таблицу shop_history.<br>";
  }

  $result = $conn->query("SHOW COLUMNS FROM shop_history LIKE 'expiry_date'");
  if ($result->num_rows === 0) {
    $conn->query("ALTER TABLE shop_history ADD COLUMN expiry_date DATETIME DEFAULT NULL AFTER purchased_at");
    echo "Поле expiry_date добавлено в таблицу shop_history.<br>";
  }
}

// Добавляем поле total_seconds в таблицу user_stats для точного отслеживания времени
$result = $conn->query("SHOW COLUMNS FROM user_stats LIKE 'total_seconds'");
if ($result->num_rows === 0) {
  $conn->query("ALTER TABLE user_stats ADD COLUMN total_seconds INT DEFAULT 0 AFTER total_time");
  echo "Поле total_seconds добавлено в таблицу user_stats.<br>";
}

// Создаем индексы для оптимизации запросов
$conn->query("CREATE INDEX IF NOT EXISTS idx_user_id ON user_stats (user_id)");
$conn->query("CREATE INDEX IF NOT EXISTS idx_username ON users (username)");
$conn->query("CREATE INDEX IF NOT EXISTS idx_last_login ON users (last_login)");
$conn->query("CREATE INDEX IF NOT EXISTS idx_premium_end_date ON user_premium (end_date)");
echo "Индексы созданы или уже существуют.<br>";

// Обновляем представление для топа игроков, чтобы исключить неактивных пользователей
$conn->query("
CREATE OR REPLACE VIEW top_players AS
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
  AND (u.last_login IS NOT NULL AND u.last_login > DATE_SUB(NOW(), INTERVAL 30 DAY))
");
echo "Представление top_players создано или обновлено.<br>";

// Создаем процедуру для автоматического обновления статуса премиума
$conn->query("
DROP PROCEDURE IF EXISTS update_premium_status;
");

$conn->query("
CREATE PROCEDURE update_premium_status()
BEGIN
  -- Деактивируем истекшие премиум-подписки
  UPDATE user_premium 
  SET is_active = 0 
  WHERE end_date < NOW() AND is_active = 1;
  
  -- Обновляем статус премиума у пользователей
  UPDATE users u
  LEFT JOIN (
      SELECT user_id, COUNT(*) as active_premium
      FROM user_premium
      WHERE end_date > NOW() AND is_active = 1
      GROUP BY user_id
  ) p ON u.id = p.user_id
  SET u.is_premium = IF(p.active_premium > 0, 1, 0);
END
");
echo "Процедура update_premium_status создана.<br>";

// Создаем событие для автоматического запуска процедуры
$conn->query("SET GLOBAL event_scheduler = ON;");
$conn->query("
DROP EVENT IF EXISTS event_update_premium;
");

$conn->query("
CREATE EVENT event_update_premium
ON SCHEDULE EVERY 1 HOUR
DO
  CALL update_premium_status();
");
echo "Событие event_update_premium создано.<br>";

// Запускаем процедуру обновления статуса премиума
$conn->query("CALL update_premium_status();");
echo "Процедура update_premium_status выполнена.<br>";

echo "Обновление таблиц завершено успешно!";

$conn->close();
?>
