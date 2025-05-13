<?php
require_once 'db-config.php';
session_start();

// VK App credentials
$client_id = '53558870';
$client_secret = 'VMZO7QLpjUX5vMyui3fp';
$redirect_uri = 'https://pixelbattle.exfil-dev.ru/vk-auth.php';
$version = '5.199';

// Get code from VK OAuth
if (isset($_GET['code'])) {
    $code = $_GET['code'];

    // Get access token
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

        // Get user info
        $user_info_url = "https://api.vk.com/method/users.get?" . http_build_query([
            'user_ids' => $user_id,
            'fields' => 'photo_100',
            'access_token' => $access_token,
            'v' => $version
        ]);

        $user_info = json_decode(file_get_contents($user_info_url), true);

        if (isset($user_info['response'][0])) {
            $user = $user_info['response'][0];
            $vk_id = $user['id'];
            $username = $user['first_name'] . ' ' . $user['last_name'];
            $avatar = $user['photo_100'];

            // Check if user exists in database
            $stmt = $conn->prepare("SELECT * FROM users WHERE vk_id = ?");
            $stmt->bind_param("s", $vk_id);
            $stmt->execute();
            $result = $stmt->get_result();

            if ($result->num_rows > 0) {
                // User exists, update info
                $user_data = $result->fetch_assoc();
                $user_id = $user_data['id'];
                $is_admin = $user_data['is_admin'];
                $is_blocked = $user_data['is_blocked'];

                // Update user info
                $stmt = $conn->prepare("UPDATE users SET username = ?, avatar = ? WHERE id = ?");
                $stmt->bind_param("sss", $username, $avatar, $user_id);
                $stmt->execute();
            } else {
                // New user, create account
                $is_admin = 0; // Default not admin
                $is_blocked = 0; // Default not blocked
                
                $stmt = $conn->prepare("INSERT INTO users (username, vk_id, avatar, is_admin, is_blocked) VALUES (?, ?, ?, ?, ?)");
                $stmt->bind_param("sssii", $username, $vk_id, $avatar, $is_admin, $is_blocked);
                $stmt->execute();
                $user_id = $conn->insert_id;
            }

            // Set session data
            $_SESSION['user_id'] = $user_id;
            $_SESSION['username'] = $username;
            $_SESSION['vk_id'] = $vk_id;
            $_SESSION['avatar'] = $avatar;
            $_SESSION['is_admin'] = $is_admin;
            $_SESSION['is_blocked'] = $is_blocked;

            // Redirect to main page
            header("Location: /");
            exit;
        } else {
            echo "Error getting user data.";
        }
    } else {
        echo "Error getting access token: ";
        print_r($data);
    }
} else {
    echo "Authorization code not received.";
}
?>