<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST');
header('Access-Control-Allow-Headers: Content-Type');

date_default_timezone_set('Asia/Shanghai');

/* ---------- 与 Student_Management 保持一致：SQLite 数据库文件统一存放 ---------- */
$DB_DIR  = '/usr/share/nginx/database';
$LOG_DIR = '/usr/share/nginx/logs';
$DB_NAME = 'Login_Info_DB';
$TABLE   = 'UserInfo_Tbl';
$LOGIN_TABLE = 'loginInfo_tbl';
$SKILL_DIR = dirname(__DIR__) . '/Skill';

function logError($message)
{
    global $LOG_DIR;
    if (!is_dir($LOG_DIR)) {
        @mkdir($LOG_DIR, 0755, true);
    }
    @file_put_contents(
        $LOG_DIR . '/login_api_error.log',
        '[' . date('Y-m-d H:i:s') . '] ' . $message . "\n",
        FILE_APPEND
    );
}

register_shutdown_function(function () {
    $error = error_get_last();
    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
    if ($error && in_array($error['type'], $fatalTypes, true)) {
        logError('Fatal Error: ' . $error['message'] . ' in ' . $error['file'] . ' on line ' . $error['line']);
        if (!headers_sent()) {
            http_response_code(500);
            echo json_encode(['code' => 1, 'message' => '服务器错误，请稍后重试'], JSON_UNESCAPED_UNICODE);
        }
    }
});

set_exception_handler(function ($e) {
    logError('Exception: ' . $e->getMessage() . ' in ' . $e->getFile() . ' on line ' . $e->getLine());
    if (!headers_sent()) {
        http_response_code(500);
        echo json_encode(['code' => 1, 'message' => '服务器错误：' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
    }
    exit;
});

function jsonResponse(int $code, string $message = '', $data = null): void
{
    $response = ['code' => $code];
    if ($message !== '') {
        $response['message'] = $message;
    }
    if ($data !== null) {
        $response['data'] = $data;
    }
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    exit;
}

function getRequestParam(string $name, $default = '')
{
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
            $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
            $jsonData = (strpos($contentType, 'application/json') !== false)
                ? json_decode($rawData, true)
                : false;
        } else {
            $jsonData = false;
        }
    }

    if (is_array($jsonData) && isset($jsonData[$name])) {
        return $jsonData[$name];
    }
    return $default;
}

/**
 * 打开（不存在则创建）Login_Info_DB.db，并确保 UserInfo_Tbl 表存在
 */
function openDb(): PDO
{
    global $DB_DIR, $DB_NAME, $TABLE, $LOGIN_TABLE;

    if (!is_dir($DB_DIR)) {
        @mkdir($DB_DIR, 0755, true);
    }

    $db = new PDO('sqlite:' . $DB_DIR . '/' . $DB_NAME . '.db');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    $db->exec(
        "CREATE TABLE IF NOT EXISTS {$TABLE} (
            Id           INTEGER PRIMARY KEY AUTOINCREMENT,
            UserName     TEXT    NOT NULL,
            UserPwd      TEXT    NOT NULL,
            UserPhone    TEXT    NOT NULL,
            WorkYears    INTEGER NOT NULL,
            RegisterTime TEXT    NOT NULL,
            IsDeleted    INTEGER NOT NULL DEFAULT 0,
            DeleteTime   TEXT
        )"
    );

    $db->exec(
        "CREATE TABLE IF NOT EXISTS {$LOGIN_TABLE} (
            Id        INTEGER PRIMARY KEY AUTOINCREMENT,
            UserName  TEXT NOT NULL,
            LoginTime TEXT NOT NULL
        )"
    );

    return $db;
}

function handleRegister(): void
{
    $username  = trim((string)getRequestParam('username', ''));
    $password  = (string)getRequestParam('password', '');
    $phone     = trim((string)getRequestParam('phone', ''));
    $workYears = trim((string)getRequestParam('workYears', ''));

    if (!preg_match('/^[\x21-\x7E]{1,30}$/', $username)) {
        jsonResponse(1, '用户名称仅支持可见字符（不含空格）');
    }
    if (!preg_match('/^[\x21-\x7E]{1,64}$/', $password)) {
        jsonResponse(1, '用户密码仅支持可见字符（不含空格）');
    }
    if (!preg_match('/^1[3-9]\d{9}$/', $phone)) {
        jsonResponse(1, '请输入正确的手机号');
    }
    if (!preg_match('/^\d+$/', $workYears) || (int)$workYears > 60) {
        jsonResponse(1, '请输入 0~60 之间的整数年限');
    }

    $db = openDb();

    $check = $db->prepare(
        'SELECT COUNT(*) FROM UserInfo_Tbl WHERE UserName = :username AND IsDeleted = 0'
    );
    $check->execute([':username' => $username]);
    if ((int)$check->fetchColumn() > 0) {
        jsonResponse(1, '该用户已经注册');
    }

    $stmt = $db->prepare(
        'INSERT INTO UserInfo_Tbl (UserName, UserPwd, UserPhone, WorkYears, RegisterTime)
         VALUES (:username, :password, :phone, :workYears, :registerTime)'
    );
    $stmt->execute([
        ':username'     => $username,
        ':password'     => password_hash($password, PASSWORD_DEFAULT),
        ':phone'        => $phone,
        ':workYears'    => (int)$workYears,
        ':registerTime' => date('Y-m-d H:i:s'),
    ]);

    jsonResponse(0, '注册成功');
}

function handleLogin(): void
{
    $username = trim((string)getRequestParam('username', ''));
    $password = (string)getRequestParam('password', '');

    if ($username === '' || $password === '') {
        jsonResponse(1, '请输入用户名称和用户登录密码');
    }

    $db = openDb();
    $stmt = $db->prepare(
        'SELECT UserPwd FROM UserInfo_Tbl
         WHERE UserName = :username AND IsDeleted = 0
         ORDER BY Id DESC
         LIMIT 1'
    );
    $stmt->execute([':username' => $username]);
    $row = $stmt->fetch();

    if (!$row || !password_verify($password, $row['UserPwd'])) {
        jsonResponse(1, '用户名称和用户密码不一致');
    }

    global $LOGIN_TABLE;
    $loginTime = date('Y-m-d H:i:s');
    $log = $db->prepare(
        "INSERT INTO {$LOGIN_TABLE} (UserName, LoginTime) VALUES (:username, :loginTime)"
    );
    $log->execute([':username' => $username, ':loginTime' => $loginTime]);

    jsonResponse(0, '登录成功', ['loginTime' => $loginTime]);
}

function handleDeleteUser(): void
{
    $username = trim((string)getRequestParam('username', ''));
    $password = (string)getRequestParam('password', '');

    if (!preg_match('/^[\x21-\x7E]{1,30}$/', $username)) {
        jsonResponse(1, '请输入正确的用户名称');
    }
    if (!preg_match('/^[\x21-\x7E]{1,64}$/', $password)) {
        jsonResponse(1, '请输入正确的用户密码');
    }

    $db = openDb();

    $stmt = $db->prepare(
        'SELECT Id, UserPwd
         FROM UserInfo_Tbl
         WHERE UserName = :username AND IsDeleted = 0
         ORDER BY Id DESC'
    );
    $stmt->execute([':username' => $username]);
    $rows = $stmt->fetchAll();

    $target = null;
    foreach ($rows as $row) {
        if (password_verify($password, $row['UserPwd'])) {
            $target = $row;
            break;
        }
    }

    if ($target === null) {
        jsonResponse(1, '输入信息与数据库中的注册信息不一致');
    }

    $now = date('Y-m-d H:i:s');
    $update = $db->prepare(
        'UPDATE UserInfo_Tbl SET IsDeleted = 1, DeleteTime = :deleteTime WHERE Id = :id'
    );
    $update->execute([':deleteTime' => $now, ':id' => $target['Id']]);

    jsonResponse(0, '该用户已删除，删除时间：' . $now);
}

/* ---------- Skill 目录浏览 ---------- */

function findSkillReadme(string $dir): ?string
{
    $items = @scandir($dir);
    if ($items === false) {
        return null;
    }
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }
        if (preg_match('/^readme(\.md|\.markdown|\.txt)?$/i', $item)) {
            $path = $dir . '/' . $item;
            if (is_file($path)) {
                return $path;
            }
        }
    }
    return null;
}

function resolveSkillDir(string $name): string
{
    global $SKILL_DIR;

    if ($name === '' || $name !== basename($name) || strpos($name, '..') !== false) {
        jsonResponse(1, '目录名称不合法');
    }

    $dir = $SKILL_DIR . '/' . $name;
    if (!is_dir($dir)) {
        jsonResponse(1, '目录不存在');
    }
    return $dir;
}

function handleListSkills(): void
{
    global $SKILL_DIR;

    if (!is_dir($SKILL_DIR)) {
        jsonResponse(1, 'Skill 目录不存在');
    }

    $items = [];
    $entries = @scandir($SKILL_DIR);
    if ($entries === false) {
        jsonResponse(1, 'Skill 目录读取失败');
    }

    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..' || $entry[0] === '.') {
            continue;
        }
        $path = $SKILL_DIR . '/' . $entry;
        if (!is_dir($path)) {
            continue;
        }
        $items[] = [
            'name'      => $entry,
            'hasReadme' => findSkillReadme($path) !== null,
        ];
    }

    usort($items, function ($a, $b) {
        return strnatcasecmp($a['name'], $b['name']);
    });

    jsonResponse(0, 'ok', ['items' => $items]);
}

function handleSkillReadme(): void
{
    $name = trim((string)getRequestParam('name', ''));
    $dir = resolveSkillDir($name);

    $file = findSkillReadme($dir);
    if ($file === null) {
        jsonResponse(1, '该目录下没有 README.MD 文件');
    }

    $size = @filesize($file);
    if ($size !== false && $size > 1048576) {
        jsonResponse(1, 'README.MD 文件过大，无法预览');
    }

    $content = @file_get_contents($file);
    if ($content === false) {
        jsonResponse(1, 'README.MD 文件读取失败');
    }

    jsonResponse(0, 'ok', [
        'name'    => $name,
        'content' => $content,
    ]);
}

function handleSkillFile(): void
{
    $name = trim((string)getRequestParam('name', ''));
    $dir = resolveSkillDir($name);

    $path = trim((string)getRequestParam('path', ''));
    if ($path === '') {
        jsonResponse(1, '文件路径不能为空');
    }

    $mimeMap = [
        'png'  => 'image/png',
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'gif'  => 'image/gif',
        'svg'  => 'image/svg+xml',
        'webp' => 'image/webp',
        'ico'  => 'image/x-icon',
    ];
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    if (!isset($mimeMap[$ext])) {
        jsonResponse(1, '不支持的文件类型');
    }

    $realDir  = realpath($dir);
    $realFile = realpath($dir . '/' . $path);
    if ($realDir === false || $realFile === false
        || strpos($realFile, $realDir . DIRECTORY_SEPARATOR) !== 0
        || !is_file($realFile)
    ) {
        jsonResponse(1, '文件不存在');
    }

    header('Content-Type: ' . $mimeMap[$ext]);
    header('Content-Length: ' . (string)filesize($realFile));
    readfile($realFile);
    exit;
}

/**
 * 将选中目录下的所有文件打包为临时 zip，返回临时文件路径
 * 优先使用 zip 扩展；服务器未安装 zip 扩展时，降级为纯 PHP 写入（不压缩）
 */
function buildSkillZip(string $dir, string $name): string
{
    $realDir = realpath($dir);
    if ($realDir === false || !is_dir($realDir)) {
        jsonResponse(1, '目录不存在');
    }

    $tmp = tempnam(sys_get_temp_dir(), 'skill_zip_');
    if ($tmp === false) {
        jsonResponse(1, '临时文件创建失败');
    }

    if (!class_exists('ZipArchive')) {
        buildZipWithoutExtension($tmp, $realDir, $name);
        return $tmp;
    }

    $zip = new ZipArchive();
    if ($zip->open($tmp, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        @unlink($tmp);
        jsonResponse(1, '压缩文件创建失败');
    }

    // 保留目录名作为压缩包内的根目录
    $zip->addEmptyDir($name);

    $failed = 0;

    try {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($realDir, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::LEAVES_ONLY
        );

        foreach ($iterator as $file) {
            if (!$file->isFile()) {
                continue;
            }
            $filePath = $file->getRealPath();
            if ($filePath === false || strpos($filePath, $realDir . DIRECTORY_SEPARATOR) !== 0) {
                continue;
            }
            $relative = substr($filePath, strlen($realDir) + 1);
            if (!$zip->addFile($filePath, $name . '/' . str_replace(DIRECTORY_SEPARATOR, '/', $relative))) {
                $failed++;
            }
        }
    } catch (Throwable $e) {
        $zip->close();
        @unlink($tmp);
        logError('Zip build failed: ' . $e->getMessage());
        jsonResponse(1, '目录打包失败，请稍后重试');
    }

    if (!$zip->close()) {
        @unlink($tmp);
        jsonResponse(1, '压缩文件写入失败');
    }

    // zip 扩展打包异常（如权限问题）时，改用纯 PHP 方式重新打包
    if ($failed > 0) {
        logError('ZipArchive addFile failed ' . $failed . ' time(s), fallback to pure zip');
        @unlink($tmp);
        $tmp = tempnam(sys_get_temp_dir(), 'skill_zip_');
        if ($tmp === false) {
            jsonResponse(1, '临时文件创建失败');
        }
        buildZipWithoutExtension($tmp, $realDir, $name);
    }

    return $tmp;
}

/**
 * 纯 PHP 实现的 zip 写入（store 方式，不压缩），用于未安装 zip 扩展的环境
 */
function buildZipWithoutExtension(string $tmp, string $realDir, string $name): void
{
    $fh = @fopen($tmp, 'wb');
    if ($fh === false) {
        @unlink($tmp);
        jsonResponse(1, '压缩文件创建失败');
    }

    $entries = [];

    $writeEntry = function (string $entryName, string $srcPath, bool $isDir) use ($fh, &$entries): void {
        if ($isDir) {
            $size = 0;
            $crc  = 0;
            $time = 0;
            $date = 0x0021; // 1980-01-01
        } else {
            $size = (int)@filesize($srcPath);
            $crc  = (int)hexdec((string)@hash_file('crc32b', $srcPath));
            $mtime = @filemtime($srcPath);
            if ($mtime === false) {
                $mtime = time();
            }
            $d = getdate($mtime);
            $time = (($d['hours'] << 11) | ($d['minutes'] << 5) | intdiv($d['seconds'], 2)) & 0xFFFF;
            $date = ((($d['year'] - 1980) << 9) | ($d['mon'] << 5) | $d['mday']) & 0xFFFF;
        }

        $offset = ftell($fh);
        fwrite($fh, pack(
            'VvvvvvVVVvv',
            0x04034b50, 20, 0x0800, 0, $time, $date, $crc, $size, $size,
            strlen($entryName), 0
        ));
        fwrite($fh, $entryName);

        if (!$isDir) {
            $in = @fopen($srcPath, 'rb');
            if ($in !== false) {
                stream_copy_to_stream($in, $fh);
                fclose($in);
            }
        }

        $entries[] = [$entryName, $crc, $size, $time, $date, $offset, $isDir];
    };

    $writeEntry($name . '/', '', true);

    try {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($realDir, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($iterator as $file) {
            $path = $file->getRealPath();
            if ($path === false) {
                continue;
            }
            if ($file->isDir()) {
                if ($file->isLink()) {
                    continue;
                }
                $relative = substr($path, strlen($realDir) + 1);
                $writeEntry(
                    $name . '/' . str_replace(DIRECTORY_SEPARATOR, '/', $relative) . '/',
                    '',
                    true
                );
                continue;
            }
            if (!$file->isFile() || strpos($path, $realDir . DIRECTORY_SEPARATOR) !== 0) {
                continue;
            }
            $relative = substr($path, strlen($realDir) + 1);
            $writeEntry($name . '/' . str_replace(DIRECTORY_SEPARATOR, '/', $relative), $path, false);
        }
    } catch (Throwable $e) {
        fclose($fh);
        @unlink($tmp);
        logError('Pure zip build failed: ' . $e->getMessage());
        jsonResponse(1, '目录打包失败，请稍后重试');
    }

    $cdStart = ftell($fh);
    foreach ($entries as $entry) {
        list($entryName, $crc, $size, $time, $date, $offset, $isDir) = $entry;
        fwrite($fh, pack(
            'VvvvvvvVVVvvvvvVV',
            0x02014b50, 20, 20, 0x0800, 0, $time, $date, $crc, $size, $size,
            strlen($entryName), 0, 0, 0, 0, $isDir ? 0x10 : 0, $offset
        ));
        fwrite($fh, $entryName);
    }
    $cdSize = ftell($fh) - $cdStart;

    fwrite($fh, pack(
        'VvvvvVVv',
        0x06054b50, 0, 0, count($entries), count($entries), $cdSize, $cdStart, 0
    ));
    fclose($fh);
}

function handleDownloadSkill(): void
{
    $name = trim((string)getRequestParam('name', ''));
    $dir = resolveSkillDir($name);

    $tmp = buildSkillZip($dir, $name);
    $size = @filesize($tmp);
    if ($size === false) {
        @unlink($tmp);
        jsonResponse(1, '压缩文件读取失败');
    }

    $safeName = preg_replace('/[^A-Za-z0-9._-]/', '_', $name);
    if ($safeName === '' || $safeName === null) {
        $safeName = 'skill';
    }

    header('Content-Type: application/zip');
    header(
        'Content-Disposition: attachment; filename="' . $safeName . '.zip"; ' .
        "filename*=UTF-8''" . rawurlencode($name . '.zip')
    );
    header('Content-Length: ' . (string)$size);
    header('Cache-Control: no-store');
    readfile($tmp);
    @unlink($tmp);
    exit;
}

$action = $_GET['action'] ?? '';

try {
    switch ($action) {
        case 'health':
            $dbDirExists = is_dir($DB_DIR);
            jsonResponse(0, '服务运行正常', [
                'php_version'       => phpversion(),
                'pdo_sqlite'        => extension_loaded('pdo_sqlite') ? 'enabled' : 'disabled',
                'db_dir'            => $DB_DIR,
                'db_dir_exists'     => $dbDirExists ? 'yes' : 'no',
                'db_dir_writable'   => ($dbDirExists && is_writable($DB_DIR)) ? 'yes' : 'no',
            ]);
            break;

        case 'login':
            handleLogin();
            break;

        case 'register':
            handleRegister();
            break;

        case 'deleteUser':
            handleDeleteUser();
            break;

        case 'listSkills':
            handleListSkills();
            break;

        case 'skillReadme':
            handleSkillReadme();
            break;

        case 'skillFile':
            handleSkillFile();
            break;

        case 'downloadSkill':
            handleDownloadSkill();
            break;

        default:
            jsonResponse(1, '未知操作');
    }
} catch (Throwable $e) {
    logError('Action failed: ' . $e->getMessage());
    jsonResponse(1, '服务器错误：' . $e->getMessage());
}
