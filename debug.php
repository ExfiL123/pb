<?php
// Включаем вывод ошибок для отладки
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// Функция для проверки доступности API
function checkApiEndpoint($url) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    curl_setopt($ch, CURLOPT_NOBODY, true);
    curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $httpCode;
}

// Проверяем структуру папок
$apiPaths = [
    '/api/auth.php',
    '/api/canvas.php',
    '/api/users.php'
];

echo "<h1>Отладка API</h1>";
echo "<h2>Проверка структуры папок</h2>";
echo "<ul>";

foreach ($apiPaths as $path) {
    $fullPath = $_SERVER['DOCUMENT_ROOT'] . $path;
    $exists = file_exists($fullPath);
    $httpCode = checkApiEndpoint('http://' . $_SERVER['HTTP_HOST'] . $path . '?action=check');
    
    echo "<li>";
    echo "Файл $path: " . ($exists ? "<span style='color:green'>существует</span>" : "<span style='color:red'>не существует</span>");
    echo " | HTTP-код: " . ($httpCode == 200 ? "<span style='color:green'>$httpCode</span>" : "<span style='color:red'>$httpCode</span>");
    echo "</li>";
}

echo "</ul>";

// Проверяем наличие файла .htaccess
$htaccessPath = $_SERVER['DOCUMENT_ROOT'] . '/.htaccess';
$htaccessExists = file_exists($htaccessPath);
echo "<h2>Проверка .htaccess</h2>";
echo ".htaccess: " . ($htaccessExists ? "<span style='color:green'>существует</span>" : "<span style='color:red'>не существует</span>");

if ($htaccessExists) {
    echo "<pre>" . htmlspecialchars(file_get_contents($htaccessPath)) . "</pre>";
}

// Проверяем сессию
echo "<h2>Проверка сессии</h2>";
session_start();
echo "<pre>";
print_r($_SESSION);
echo "</pre>";

// Проверяем подключение к базе данных
echo "<h2>Проверка подключения к базе данных</h2>";
try {
    require_once 'db-config.php';
    echo "<span style='color:green'>Подключение к базе данных успешно</span>";
} catch (Exception $e) {
    echo "<span style='color:red'>Ошибка подключения к базе данных: " . $e->getMessage() . "</span>";
}
?>