<?php
// Configurações do Banco de Dados
$host = 'localhost';
$dbname = 'sistema_login';
$user = 'root'; // Altere conforme necessário para o seu ambiente
$pass = '';     // Altere conforme necessário

try {
    // Conexão via PDO com charset UTF8MB4
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass);
    
    // Configura o PDO para lançar exceções em caso de erros
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

} catch (PDOException $e) {
    // Em produção, registre o erro em um log, não exiba diretamente para o usuário
    die("Erro na conexão com o banco de dados. " . $e->getMessage());
}
?>
