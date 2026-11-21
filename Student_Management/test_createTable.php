<?php
$apiUrl = 'https://studytech.cloud/Student_Management/api.php';

echo "=== 1. Health Check ===\n";
$healthResponse = file_get_contents($apiUrl . '?action=health');
echo "Response: " . $healthResponse . "\n\n";

echo "=== 2. Create Table Test ===\n";
$postData = json_encode(array(
    'dbName' => 'studentInfo',
    'tableName' => 'test_table_' . time(),
    'columns' => array(
        array('name' => 'id', 'type' => 'INTEGER', 'primaryType' => 'primary_auto'),
        array('name' => 'name', 'type' => 'TEXT', 'primaryType' => 'none')
    )
));

$options = array(
    'http' => array(
        'header' => "Content-Type: application/json\r\n",
        'method' => 'POST',
        'content' => $postData,
        'ignore_errors' => true
    )
);

$context = stream_context_create($options);
$response = file_get_contents($apiUrl . '?action=createTable', false, $context);

$httpStatus = isset($http_response_header[0]) ? $http_response_header[0] : 'Unknown';
echo "HTTP Status: " . $httpStatus . "\n";
echo "Response: " . $response . "\n";
?>
