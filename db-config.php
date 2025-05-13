<?php
// Конфигурация подключения к базе данных
$db_host = 'localhost';
$db_name = 'cj81549_pb';
$db_user = 'cj81549_pb';
$db_pass = '7713Cema';

// Создание подключения
$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);

// Проверка подключения
if ($conn->connect_error) {
    die("Ошибка подключения: " . $conn->connect_error);
}

// Установка кодировки
$conn->set_charset("utf8mb4");
?>
