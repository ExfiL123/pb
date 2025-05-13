<?php
// vk.php

session_start();

// Замени на свои данные
$client_id = '53555986'; // ID приложения VK
$client_secret = 'PlDszqLz1wOFOhWP3AjA'; // Защищённый ключ
$redirect_uri = 'https://pixelbattle.exfil-dev.ru'; // Тот же URI, что в настройках VK
$version = '5.199';

// Получение кода после авторизации
if (isset($_GET['code'])) {
    $code = $_GET['code'];

    // Получение access_token
    $token_url = "https://oauth.vk.com/access_token?" . http_build_query([
        'client_id' => $client_id,
        'client_secret' => $client_secret,
        'redirect_uri' => $redirect_uri,
        'code' => $code
    ]);

    $response = file_get_contents($token_url);
    $data = json_decode($response, true);

    if (isset($data['access_token'])) {
        $access_token = $data['access_token'];
        $user_id = $data['user_id'];

        // Получение информации о пользователе
        $user_info_url = "https://api.vk.com/method/users.get?" . http_build_query([
            'user_ids' => $user_id,
            'fields' => 'photo_100',
            'access_token' => $access_token,
            'v' => $version
        ]);

        $user_info = json_decode(file_get_contents($user_info_url), true);

        if (isset($user_info['response'][0])) {
            $user = $user_info['response'][0];

            // Сохраняем в сессии
            $_SESSION['user'] = [
                'id' => $user['id'],
                'name' => $user['first_name'] . ' ' . $user['last_name'],
                'photo' => $user['photo_100']
            ];

            // Перенаправляем на главную страницу
            header("Location: /");
            exit;
        } else {
            echo "Ошибка получения данных пользователя.";
        }
    } else {
        echo "Ошибка получения access_token: ";
        print_r($data);
    }
} else {
    echo "Код авторизации не получен.";
}
