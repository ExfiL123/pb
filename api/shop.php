<?php

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
        
        // Проверяем, существует ли колонка item_type в таблице shop_history
        $tableCheckResult = $conn->query("SHOW COLUMNS FROM shop_history LIKE 'item_type'");
        
        if ($tableCheckResult->num_rows === 0) {
            // Если колонки нет, добавляем ее
            $conn->query("ALTER TABLE shop_history ADD COLUMN item_type VARCHAR(50) NOT NULL AFTER item_id");
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
