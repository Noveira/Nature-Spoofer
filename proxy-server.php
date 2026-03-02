<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// cgauth API Configuration
$API_KEY = 'ffcc90ea46a2a2f75b0ea9cdf4c56730697deb415dfeddf7cb5542c7698c169e';
$API_SECRET = 'd9ddc48b80982ec7168633558ea4f318f1012e0b6d6d9b1475d6dd5a154207b3';
$API_BASE_URL = 'https://cgauth.com/api/v1';

$input = json_decode(file_get_contents('php://input'), true);
$licenseKey = $input['licenseKey'] ?? '';

if (empty($licenseKey)) {
    echo json_encode(['success' => false, 'error' => 'License key required']);
    exit;
}

// cgauth API'sine lisans doğrulama isteği
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "$API_BASE_URL/licenses/validate");
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $API_KEY,
    'Content-Type: application/json',
    'X-API-Secret: ' . $API_SECRET
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'license_key' => $licenseKey
]));
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

// Debug log
error_log("cgauth Response: $response");
error_log("HTTP Code: $httpCode");

if ($httpCode === 200 && $response) {
    $data = json_decode($response, true);
    
    // cgauth'dan gelen response'u normalize et
    if (isset($data['valid']) && $data['valid'] === true) {
        echo json_encode([
            'success' => true,
            'valid' => true,
            'duration' => $data['expires_in'] ?? 24,
            'unit' => 'hours',
            'isAdmin' => $data['is_admin'] ?? false,
            'user' => $data['user'] ?? null
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'error' => $data['message'] ?? 'Invalid license'
        ]);
    }
} else {
    echo json_encode([
        'success' => false,
        'error' => 'API connection failed: ' . $error,
        'http_code' => $httpCode
    ]);
}
?>
