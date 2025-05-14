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

// Получение данных запроса
$data = json_decode(file_get_contents('php://input'), true);
$action = isset($_GET['action']) ? $_GET['action'] : '';

// Обработка различных действий
switch ($action) {
    case 'buy':
        $user_id = checkAuth();
        buyItem($conn, $user_id, $data);
        break;
    case 'get_items':
        $user_id = checkAuth();
        getItems($conn, $user_id);
        break;
    default:
        echo json_encode(['error' => 'Unknown action']);
        break;
}

// Функция для получения доступных товаров
function getItems($conn, $user_id) {
    // Получаем текущее количество коинов пользователя
    $stmt = $conn->prepare("SELECT coins FROM user_stats WHERE user_id = ?");
    $stmt->bind_param("s", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode(['error' => 'User stats not found']);
        return;
    }
    
    $userStats = $result->fetch_assoc();
    $userCoins = (int)$userStats['coins'];
    
    // Список доступных товаров
    $items = [
        [
            'id' => 'bomb',
            'name' => 'Бомбочка',
            'description' => 'Стирает 10 ближайших пикселей',
            'price' => 10,
            'type' => 'consumable',
            'canBuy' => $userCoins >= 10
        ],
        [
            'id' => 'premium',
            'name' => 'Прем��ум',
            'description' => 'Премиум-статус на 30 дней: цветной ник, отсутствие задержки при размещении пикселей',
            'price' => 1000,
            'type' => 'subscription',
            'canBuy' => $userCoins >= 1000
        ]
    ];
    
    echo json_encode([
        'items' => $items,
        'userCoins' => $userCoins
    ]);
}

// Функция для покупки товара
function buyItem($conn, $user_id, $data) {
    $itemId = $data['itemId'] ?? '';
    
    if (empty($itemId)) {
        echo json_encode(['error' => 'Item ID is required']);
        return;
    }
    
    // Получаем текущее количество коинов пользователя
    $stmt = $conn->prepare("SELECT coins FROM user_stats WHERE user_id = ?");
    $stmt->bind_param("s", $user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows === 0) {
        echo json_encode(['error' => 'User stats not found']);
        return;
    }
    
    $userStats = $result->fetch_assoc();
    $userCoins = (int)$userStats['coins'];
    
    // Определяем цену и тип предмета
    $price = 0;
    $itemType = '';
    
    switch ($itemId) {
        case 'bomb':
            $price = 10;
            $itemType = 'consumable';
            break;
        case 'premium':
            $price = 1000; // Обновлено до 1000 коинов
            $itemType = 'subscription';
            break;
        default:
            echo json_encode(['error' => 'Unknown item']);
            return;
    }
    
    // Проверяем, достаточно ли коинов
    if ($userCoins < $price) {
        echo json_encode(['error' => 'Not enough coins']);
        return;
    }
    
    // Начинаем транзакцию
    $conn->begin_transaction();
    
    try {
        // Списываем коины
        $stmt = $conn->prepare("UPDATE user_stats SET coins = coins - ? WHERE user_id = ?");
        $stmt->bind_param("is", $price, $user_id);
        $stmt->execute();
        
        // Проверяем, существует ли таблица shop_history
        $tableCheckResult = $conn->query("SHOW TABLES LIKE 'shop_history'");
        
        if ($tableCheckResult->num_rows === 0) {
            // Если таблицы нет, создаем ее
            $conn->query("
                CREATE TABLE shop_history (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id VARCHAR(255) NOT NULL,
                    item_id VARCHAR(50) NOT NULL,
                    item_type VARCHAR(50) NOT NULL,
                    price INT NOT NULL,
                    purchased_at DATETIME NOT NULL,
                    expiry_date DATETIME NULL,
                    INDEX (user_id),
                    INDEX (purchased_at)
                )
            ");
        } else {
            // Проверяем, существует ли колонка item_type в таблице shop_history
            $columnCheckResult = $conn->query("SHOW COLUMNS FROM shop_history LIKE 'item_type'");
            
            if ($columnCheckResult->num_rows === 0) {
                // Если колонки нет, добавляем ее
                $conn->query("ALTER TABLE shop_history ADD COLUMN item_type VARCHAR(50) NOT NULL AFTER item_id");
            }
        }
        
        // Записываем покупку в историю
        $stmt = $conn->prepare("INSERT INTO shop_history (user_id, item_id, item_type, price, purchased_at) VALUES (?, ?, ?, ?, NOW())");
        $stmt->bind_param("sssi", $user_id, $itemId, $itemType, $price);
        $stmt->execute();
        $purchaseId = $conn->insert_id;
        
        // Если это премиум, активируем его
        if ($itemId === 'premium') {
            // Устанавливаем срок действия (30 дней)
            $expiryDate = date('Y-m-d H:i:s', strtotime('+30 days'));
            
            // Обновляем запись в истории покупок
            $stmt = $conn->prepare("UPDATE shop_history SET expiry_date = ? WHERE id = ?");
            $stmt->bind_param("si", $expiryDate, $purchaseId);
            $stmt->execute();
            
            // Проверяем, существует ли таблица user_premium
            $tableCheckResult = $conn->query("SHOW TABLES LIKE 'user_premium'");
            
            if ($tableCheckResult->num_rows === 0) {
                // Если таблицы нет, создаем ее
                $conn->query("
                    CREATE TABLE user_premium (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id VARCHAR(255) NOT NULL,
                        start_date DATETIME NOT NULL,
                        end_date DATETIME NOT NULL,
                        INDEX (user_id),
                        INDEX (end_date)
                    )
                ");
            }
            
            // Добавляем запись в таблицу премиум-подписок
            $stmt = $conn->prepare("INSERT INTO user_premium (user_id, start_date, end_date) VALUES (?, NOW(), ?)");
            $stmt->bind_param("ss", $user_id, $expiryDate);
            $stmt->execute();
            
            // Обновляем статус премиума у пользователя
            $stmt = $conn->prepare("UPDATE users SET is_premium = 1 WHERE id = ?");
            $stmt->bind_param("s", $user_id);
            $stmt->execute();
            
            // Обновляем сессию
            $_SESSION['is_premium'] = true;
        }
        
        // Завершаем транзакцию
        $conn->commit();
        
        echo json_encode([
            'success' => true,
            'message' => 'Item purchased successfully',
            'remaining_coins' => $userCoins - $price
        ]);
    } catch (Exception $e) {
        // Откатываем транзакцию в случае ошибки
        $conn->rollback();
        echo json_encode(['error' => 'Error processing purchase: ' . $e->getMessage()]);
    }
}
?>
