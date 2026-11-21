<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

$DB_DIR = '/usr/share/nginx/database';
$LOG_DIR = '/usr/share/nginx/logs';

function logError($message) {
    global $LOG_DIR;
    if (!file_exists($LOG_DIR)) {
        mkdir($LOG_DIR, 0755, true);
    }
    $logFile = $LOG_DIR . '/api_error.log';
    $timestamp = date('Y-m-d H:i:s');
    file_put_contents($logFile, "[$timestamp] $message\n", FILE_APPEND);
}

register_shutdown_function(function() {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR])) {
        $errorMsg = "Fatal Error [" . $error['type'] . "]: " . $error['message'] . " in " . $error['file'] . " on line " . $error['line'];
        logError($errorMsg);
        if (!headers_sent()) {
            http_response_code(500);
            echo json_encode(array('success' => false, 'message' => '致命错误: ' . $error['message']));
        }
    }
});

set_error_handler(function($errno, $errstr, $errfile, $errline) {
    if (!($errno & error_reporting())) {
        return false;
    }
    
    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
    if (in_array($errno, $fatalTypes)) {
        $errorMsg = "PHP Error [$errno]: $errstr in $errfile on line $errline";
        logError($errorMsg);
        http_response_code(500);
        echo json_encode(array('success' => false, 'message' => 'PHP错误: ' . $errstr));
        exit;
    }
    
    $warningTypes = [E_WARNING, E_CORE_WARNING, E_COMPILE_WARNING, E_USER_WARNING];
    if (in_array($errno, $warningTypes)) {
        $errorMsg = "PHP Warning [$errno]: $errstr in $errfile on line $errline";
        logError($errorMsg);
    }
    
    return false;
});

set_exception_handler(function($e) {
    $errorMsg = "Exception: " . get_class($e) . " - " . $e->getMessage() . " in " . $e->getFile() . " on line " . $e->getLine();
    logError($errorMsg);
    http_response_code(500);
    echo json_encode(array('success' => false, 'message' => '服务器错误: ' . $e->getMessage()));
    exit;
});

function ensureDbDir() {
    global $DB_DIR;
    if (!file_exists($DB_DIR)) {
        mkdir($DB_DIR, 0755, true);
    }
}

function validateDbName($name) {
    if (empty($name) || trim($name) === '') return false;
    if (strlen($name) > 100) return false;
    if (!preg_match('/^[a-zA-Z0-9_-]+$/', $name)) return false;
    return true;
}

function validateTableName($name) {
    if (empty($name) || trim($name) === '') return false;
    if (strlen($name) > 100) return false;
    if (!preg_match('/^[a-zA-Z0-9_-]+$/', $name)) return false;
    return true;
}

function getDbPath($dbName) {
    global $DB_DIR;
    $sanitized = preg_replace('/[^a-zA-Z0-9_-]/', '_', $dbName);
    return $DB_DIR . '/' . $sanitized . '.db';
}

function getRequestParam($name, $default = '') {
    if (isset($_POST[$name])) {
        return $_POST[$name];
    }
    if (isset($_GET[$name])) {
        return $_GET[$name];
    }
    
    static $jsonData = null;
    if ($jsonData === null) {
        $rawData = @file_get_contents('php://input');
        if ($rawData) {
            $contentType = isset($_SERVER['CONTENT_TYPE']) ? $_SERVER['CONTENT_TYPE'] : '';
            if (strpos($contentType, 'application/json') !== false) {
                $jsonData = json_decode($rawData, true);
            } else {
                $jsonData = false;
            }
        } else {
            $jsonData = false;
        }
    }
    
    if ($jsonData !== false && is_array($jsonData) && isset($jsonData[$name])) {
        return $jsonData[$name];
    }
    return $default;
}

function jsonResponse($success, $message = '', $data = null) {
    $response = array('success' => $success);
    if ($message) $response['message'] = $message;
    if ($data !== null) $response['data'] = $data;
    echo json_encode($response);
    exit;
}

$action = isset($_GET['action']) ? $_GET['action'] : '';

try {
    switch ($action) {
        case 'health':
            $version = '20260712-v8';
            $pdoSqlite = extension_loaded('pdo_sqlite') ? 'enabled' : 'disabled';
            $phpVersion = phpversion();
            $dbDirWritable = is_writable($DB_DIR) ? 'writable' : 'not writable';
            $dbDirExists = file_exists($DB_DIR) ? 'exists' : 'not exists';
            jsonResponse(true, 'Server is running', array(
                'version' => $version,
                'php_version' => $phpVersion,
                'pdo_sqlite' => $pdoSqlite,
                'db_dir' => $DB_DIR,
                'db_dir_exists' => $dbDirExists,
                'db_dir_writable' => $dbDirWritable
            ));
            break;

        case 'debugParams':
            $dbName = getRequestParam('dbName', '');
            $tableName = getRequestParam('tableName', '');
            $columns = getRequestParam('columns', null);
            
            $columnDefs = array();
            if (is_array($columns)) {
                foreach ($columns as $i => $col) {
                    $type = isset($col['type']) ? $col['type'] : 'TEXT';
                    $def = $col['name'] . ' ' . $type;
                    if (isset($col['primaryType']) && $col['primaryType'] === 'primary_auto') {
                        $def .= ' PRIMARY KEY AUTOINCREMENT';
                    } elseif (isset($col['primaryType']) && $col['primaryType'] === 'primary') {
                        $def .= ' PRIMARY KEY';
                    }
                    $columnDefs[] = $def;
                }
            }
            
            $sql = 'CREATE TABLE ' . $tableName . ' (' . implode(', ', $columnDefs) . ')';
            
            jsonResponse(true, '参数调试信息', array(
                'dbName' => $dbName,
                'tableName' => $tableName,
                'columns' => $columns,
                'columnDefs' => $columnDefs,
                'generated_sql' => $sql,
                'columns_type' => gettype($columns),
                'columns_json' => json_encode($columns)
            ));
            break;

        case 'listDatabases':
            ensureDbDir();
            $files = scandir($DB_DIR);
            $databases = array();
            foreach ($files as $file) {
                if (strpos($file, '.db') === strlen($file) - 3) {
                    $databases[] = substr($file, 0, -3);
                }
            }
            jsonResponse(true, '', $databases);
            break;

        case 'createDatabase':
            $name = getRequestParam('name', '');
            if (!validateDbName($name)) {
                http_response_code(400);
                jsonResponse(false, '数据库名称无效，只能包含字母、数字、下划线和短横线');
            }
            ensureDbDir();
            $dbPath = getDbPath($name);
            if (file_exists($dbPath)) {
                http_response_code(400);
                jsonResponse(false, '数据库已存在');
            }
            $db = new PDO('sqlite:' . $dbPath);
            $db = null;
            jsonResponse(true, "数据库 \"$name\" 创建成功", $dbPath);
            break;

        case 'deleteDatabase':
            $name = getRequestParam('name', '');
            if (!validateDbName($name)) {
                http_response_code(400);
                jsonResponse(false, '数据库名称无效');
            }
            $dbPath = getDbPath($name);
            if (!file_exists($dbPath)) {
                http_response_code(404);
                jsonResponse(false, '数据库不存在');
            }
            unlink($dbPath);
            jsonResponse(true, "数据库 \"$name\" 已删除");
            break;

        case 'listTables':
            $dbName = isset($_GET['dbName']) ? $_GET['dbName'] : '';
            if (!validateDbName($dbName)) {
                http_response_code(400);
                jsonResponse(false, '数据库名称无效');
            }
            $dbPath = getDbPath($dbName);
            if (!file_exists($dbPath)) {
                http_response_code(404);
                jsonResponse(false, '数据库不存在');
            }
            $db = new PDO('sqlite:' . $dbPath);
            $stmt = $db->query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
            $tables = array();
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                if ($row['name'] !== 'sqlite_sequence') {
                    $tables[] = $row['name'];
                }
            }
            $db = null;
            jsonResponse(true, '', $tables);
            break;

        case 'createTable':
            $dbName = getRequestParam('dbName', '');
            $tableName = getRequestParam('tableName', '');
            $columns = getRequestParam('columns', null);
            
            if (is_string($columns)) {
                $decoded = json_decode($columns, true);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    http_response_code(400);
                    jsonResponse(false, '字段数据格式错误，JSON解析失败: ' . json_last_error_msg());
                }
                $columns = $decoded;
            }
            
            if (!validateDbName($dbName)) {
                http_response_code(400);
                jsonResponse(false, '数据库名称无效');
            }
            if (!validateTableName($tableName)) {
                http_response_code(400);
                jsonResponse(false, '表名无效，只能包含字母、数字、下划线和短横线');
            }
            if (!is_array($columns) || empty($columns)) {
                http_response_code(400);
                jsonResponse(false, '请至少添加一个字段，columns类型: ' . gettype($columns) . ', 值: ' . (is_string($columns) ? $columns : (is_array($columns) ? 'empty_array' : 'null')));
            }
            
            $dbPath = getDbPath($dbName);
            if (!file_exists($dbPath)) {
                http_response_code(404);
                jsonResponse(false, '数据库不存在，路径: ' . $dbPath);
            }
            
            $dbDir = dirname($dbPath);
            if (!is_writable($dbDir)) {
                http_response_code(500);
                jsonResponse(false, '数据库目录不可写，请联系管理员修复权限，目录: ' . $dbDir);
            }
            
            if (!is_writable($dbPath)) {
                http_response_code(500);
                jsonResponse(false, '数据库文件不可写，请联系管理员修复权限，文件: ' . $dbPath);
            }
            
            try {
                $db = new PDO('sqlite:' . $dbPath);
                $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            } catch (PDOException $e) {
                http_response_code(500);
                jsonResponse(false, '数据库连接失败，路径: ' . $dbPath . ', 错误: ' . $e->getMessage());
            }
            
            $stmt = $db->query("SELECT name FROM sqlite_master WHERE type='table' AND name=" . $db->quote($tableName));
            if ($stmt->fetch()) {
                http_response_code(400);
                jsonResponse(false, '表 "' . $tableName . '" 已存在');
            }
            
            $columnDefs = array();
            foreach ($columns as $i => $col) {
                if (empty($col['name'])) {
                    http_response_code(400);
                    jsonResponse(false, "第 " . ($i + 1) . " 个字段名不能为空");
                }
                $type = isset($col['type']) ? $col['type'] : 'TEXT';
                $def = $col['name'] . ' ' . $type;
                
                if (isset($col['primaryType']) && $col['primaryType'] === 'primary_auto') {
                    if ($type !== 'INTEGER') {
                        http_response_code(400);
                        jsonResponse(false, '自增主键只支持INTEGER类型');
                    }
                    $def .= ' PRIMARY KEY AUTOINCREMENT';
                } elseif (isset($col['primaryType']) && $col['primaryType'] === 'primary') {
                    $def .= ' PRIMARY KEY';
                }
                
                $columnDefs[] = $def;
            }
            
            $sql = 'CREATE TABLE ' . $tableName . ' (' . implode(', ', $columnDefs) . ')';
            logError('createTable SQL: ' . $sql);
            
            $debug = getRequestParam('debug', false);
            if ($debug) {
                jsonResponse(true, '调试模式 - 生成的SQL语句', array('sql' => $sql, 'tableName' => $tableName, 'columns' => $columns));
            }
            
            try {
                $db->exec($sql);
            } catch (PDOException $e) {
                logError('createTable failed: ' . $e->getMessage() . ', SQL: ' . $sql);
                throw $e;
            }
            $db = null;
            
            jsonResponse(true, "表 \"$tableName\" 创建成功");
            break;

        case 'importData':
            try {
                $dbName = getRequestParam('dbName', '');
                $tableName = getRequestParam('tableName', '');
                $excelData = getRequestParam('excelData', null);
                
                logError("importData called - dbName: $dbName, tableName: $tableName");
                
                if (is_string($excelData)) {
                    logError("excelData is string, decoding...");
                    $excelData = json_decode($excelData, true);
                    if (json_last_error() !== JSON_ERROR_NONE) {
                        logError("JSON decode failed: " . json_last_error_msg());
                        http_response_code(400);
                        jsonResponse(false, 'Excel数据JSON解析失败');
                    }
                }
                
                logError("excelData type: " . gettype($excelData) . ", count: " . (is_array($excelData) ? count($excelData) : 'N/A'));
                
                if (!validateDbName($dbName)) {
                    http_response_code(400);
                    jsonResponse(false, '数据库名称无效');
                }
                if (!validateTableName($tableName)) {
                    http_response_code(400);
                    jsonResponse(false, '表名无效');
                }
                if (!is_array($excelData) || count($excelData) < 2) {
                    http_response_code(400);
                    jsonResponse(false, 'Excel数据无效，至少需要包含表头和一行数据');
                }
                
                $dbPath = getDbPath($dbName);
                logError("dbPath: $dbPath, exists: " . (file_exists($dbPath) ? 'yes' : 'no'));
                
                if (!file_exists($dbPath)) {
                    http_response_code(404);
                    jsonResponse(false, '数据库不存在');
                }
                
                $dbDir = dirname($dbPath);
                if (!is_writable($dbDir)) {
                    logError("dbDir not writable: $dbDir");
                    http_response_code(500);
                    jsonResponse(false, '数据库目录不可写，请联系管理员修复权限，目录: ' . $dbDir);
                }
                
                if (!is_writable($dbPath)) {
                    logError("dbPath not writable: $dbPath");
                    http_response_code(500);
                    jsonResponse(false, '数据库文件不可写，请联系管理员修复权限，文件: ' . $dbPath);
                }
                
                $db = new PDO('sqlite:' . $dbPath);
                $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                
                $headers = $excelData[0];
                $rows = array_slice($excelData, 1);
                
                logError("headers: " . implode(', ', $headers));
                logError("rows count: " . count($rows));
                
                $columns = array();
                foreach ($headers as $h) {
                    $columns[] = $h;
                }
                
                $placeholders = array_fill(0, count($headers), '?');
                $insertSql = 'INSERT INTO ' . $tableName . ' (' . implode(', ', $columns) . ') VALUES (' . implode(', ', $placeholders) . ')';
                
                logError("insertSql: $insertSql");
                
                $insertedCount = 0;
                foreach ($rows as $row) {
                    $params = array();
                    foreach ($headers as $idx => $h) {
                        $cell = isset($row[$idx]) ? $row[$idx] : null;
                        $params[] = $cell;
                    }
                    $stmt = $db->prepare($insertSql);
                    $stmt->execute($params);
                    $insertedCount++;
                }
                
                $db = null;
                logError("importData success - inserted: $insertedCount");
                jsonResponse(true, "成功导入 $insertedCount 条数据", array('count' => $insertedCount));
            } catch (Exception $e) {
                logError("importData Exception: " . $e->getMessage() . " in " . $e->getFile() . " on line " . $e->getLine());
                http_response_code(500);
                jsonResponse(false, '数据库操作失败: ' . $e->getMessage());
            }
            break;

        case 'query':
            $dbName = getRequestParam('dbName', '');
            $sql = getRequestParam('sql', '');
            
            if (!validateDbName($dbName)) {
                http_response_code(400);
                jsonResponse(false, '数据库名称无效');
            }
            if (empty($sql)) {
                http_response_code(400);
                jsonResponse(false, '请输入SQL语句');
            }
            
            $dbPath = getDbPath($dbName);
            if (!file_exists($dbPath)) {
                http_response_code(404);
                jsonResponse(false, '数据库不存在');
            }
            
            $db = new PDO('sqlite:' . $dbPath);
            $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            
            $stmt = $db->query($sql);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $columns = count($rows) > 0 ? array_keys($rows[0]) : array();
            
            $db = null;
            jsonResponse(true, '', array('columns' => $columns, 'data' => $rows, 'count' => count($rows)));
            break;

        default:
            http_response_code(404);
            jsonResponse(false, '未知操作');
            break;
    }
} catch (PDOException $e) {
    http_response_code(500);
    jsonResponse(false, '数据库操作失败: ' . $e->getMessage());
} catch (Exception $e) {
    http_response_code(500);
    jsonResponse(false, '操作失败: ' . $e->getMessage());
} catch (Error $e) {
    http_response_code(500);
    jsonResponse(false, '系统错误: ' . $e->getMessage());
}
?>