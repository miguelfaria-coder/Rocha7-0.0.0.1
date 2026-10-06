<?php
session_start();
require_once 'conexao.php';

// Verifica se os dados vieram via POST
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = filter_input(INPUT_POST, 'email', FILTER_VALIDATE_EMAIL);
    $senha = $_POST['senha'] ?? '';
    
    // Retorno simples JSON para exibir alertas na página, ou pode redirecionar
    if (!$email || empty($senha)) {
        die(json_encode(['sucesso' => false, 'mensagem' => 'Preencha todos os campos corretamente.']));
    }

    try {
        // Busca o usuário pelo e-mail
        $stmt = $pdo->prepare("SELECT id, nome, email, senha_hash, status, papel_id FROM usuarios WHERE email = :email LIMIT 1");
        $stmt->bindParam(':email', $email);
        $stmt->execute();
        $usuario = $stmt->fetch();

        // Se encontrou usuário e o hash confere
        if ($usuario && password_verify($senha, $usuario['senha_hash'])) {
            
            // Verifica o status do usuário
            if ($usuario['status'] !== 'ativo') {
                die(json_encode(['sucesso' => false, 'mensagem' => 'Sua conta não está ativa. Status: ' . $usuario['status']]));
            }

            // Sucesso no login, cria sessão
            $_SESSION['usuario_id'] = $usuario['id'];
            $_SESSION['usuario_nome'] = $usuario['nome'];
            $_SESSION['usuario_email'] = $usuario['email'];
            $_SESSION['usuario_papel'] = $usuario['papel_id'];

            // Opcional: Registrar no log_acessos (sucesso)
            $ip = $_SERVER['REMOTE_ADDR'];
            $ua = $_SERVER['HTTP_USER_AGENT'];
            $stmtLog = $pdo->prepare("INSERT INTO log_acessos (usuario_id, email_tentativa, ip_origem, user_agent, sucesso) VALUES (?, ?, ?, ?, 1)");
            $stmtLog->execute([$usuario['id'], $email, $ip, $ua]);

            // Responde sucesso
            echo json_encode(['sucesso' => true, 'mensagem' => 'Login realizado com sucesso!', 'nome' => $usuario['nome'], 'email' => $usuario['email'], 'redirect' => 'index.html']);
            exit;

        } else {
            // Falha na senha ou usuário não encontrado
            // Opcional: Registrar no log_acessos (falha)
            $ip = $_SERVER['REMOTE_ADDR'];
            $ua = $_SERVER['HTTP_USER_AGENT'];
            $userIdLog = $usuario ? $usuario['id'] : null;
            $stmtLog = $pdo->prepare("INSERT INTO log_acessos (usuario_id, email_tentativa, ip_origem, user_agent, sucesso) VALUES (?, ?, ?, ?, 0)");
            $stmtLog->execute([$userIdLog, $email, $ip, $ua]);

            // Se o usuário existir, incrementa tentativas falhas... (Lógica simplificada aqui)
            
            echo json_encode(['sucesso' => false, 'mensagem' => 'E-mail ou senha incorretos.']);
            exit;
        }

    } catch (PDOException $e) {
        die(json_encode(['sucesso' => false, 'mensagem' => 'Erro interno do servidor.']));
    }
} else {
    header("Location: ../login.html");
    exit;
}
?>
