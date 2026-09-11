<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$dataDir = __DIR__ . DIRECTORY_SEPARATOR . 'data';
if (!is_dir($dataDir)) mkdir($dataDir, 0777, true);

function respond($ok, $data = [], $code = 200) {
    http_response_code($code);
    echo json_encode(array_merge(['ok' => $ok], $data), JSON_UNESCAPED_UNICODE);
    exit;
}
function clean($v, $max = 40) {
    $v = trim((string)$v);
    $v = preg_replace('/[^\p{L}\p{N}_\- ]/u', '', $v);
    return mb_substr($v, 0, $max);
}
function roomFile($code) { global $dataDir; return $dataDir . DIRECTORY_SEPARATOR . $code . '.json'; }
function loadRoom($code) {
    $file = roomFile($code);
    if (!file_exists($file)) return null;
    $fp = fopen($file, 'r');
    if (!$fp) return null;
    flock($fp, LOCK_SH); $raw = stream_get_contents($fp); flock($fp, LOCK_UN); fclose($fp);
    $room = json_decode($raw, true);
    return is_array($room) ? $room : null;
}
function saveRoom($code, $room) {
    $file = roomFile($code);
    $fp = fopen($file, 'c+');
    if (!$fp) return false;
    flock($fp, LOCK_EX); ftruncate($fp, 0); rewind($fp);
    fwrite($fp, json_encode($room, JSON_UNESCAPED_UNICODE)); fflush($fp); flock($fp, LOCK_UN); fclose($fp);
    return true;
}
function newCode() { return strtoupper(substr(bin2hex(random_bytes(4)), 0, 6)); }

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$code = strtoupper(preg_replace('/[^A-Z0-9]/', '', $_POST['code'] ?? $_GET['code'] ?? ''));
$name = clean($_POST['name'] ?? $_GET['name'] ?? 'ゲスト');
$score = max(0, (int)($_POST['score'] ?? 0));

if ($action === 'create') {
    do { $code = newCode(); } while (file_exists(roomFile($code)));
    $room = ['code'=>$code, 'createdAt'=>time(), 'players'=>[]];
    saveRoom($code, $room);
    respond(true, ['code'=>$code]);
}

if ($action === 'join') {
    if (!$code) respond(false, ['message'=>'合言葉を入力してください'], 400);
    $room = loadRoom($code);
    if (!$room) respond(false, ['message'=>'その合言葉の部屋が見つかりません'], 404);
    $id = bin2hex(random_bytes(8));
    $room['players'][$id] = ['id'=>$id, 'name'=>$name ?: 'ゲスト', 'score'=>0, 'updatedAt'=>time()];
    saveRoom($code, $room);
    respond(true, ['playerId'=>$id, 'players'=>array_values($room['players'])]);
}

if ($action === 'score') {
    if (!$code) respond(false, ['message'=>'部屋が指定されていません'], 400);
    $room = loadRoom($code);
    if (!$room || !isset($room['players'][$_POST['playerId'] ?? ''])) respond(false, ['message'=>'部屋または参加者が見つかりません'], 404);
    $id = $_POST['playerId'];
    $room['players'][$id]['score'] = $score;
    $room['players'][$id]['name'] = $name ?: $room['players'][$id]['name'];
    $room['players'][$id]['updatedAt'] = time();
    saveRoom($code, $room);
    respond(true, ['players'=>array_values($room['players'])]);
}

if ($action === 'ranking') {
    if (!$code) respond(false, ['message'=>'部屋が指定されていません'], 400);
    $room = loadRoom($code);
    if (!$room) respond(false, ['message'=>'その合言葉の部屋が見つかりません'], 404);
    $players = array_values($room['players']);
    usort($players, function($a,$b){ return $b['score'] <=> $a['score']; });
    respond(true, ['players'=>$players]);
}

respond(false, ['message'=>'不正なリクエストです'], 400);
