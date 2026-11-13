# PRECISA CONNECT

# Connect — Rede Social

A Connect é uma plataforma de interação social desenvolvida com HTML, CSS, JavaScript e Firebase.

## Funcionalidades

- Cadastro de usuários
- Login com Firebase Authentication
- Perfil de usuário
- Publicações de textos
- Publicações com imagens
- Curtidas
- Comentários
- Busca de pessoas
- Conversas privadas entre usuários
- Notificações (estrutura visual)
- Feed de publicações

## Arquivos

| Arquivo | Função |
|---|---|
| index.html | Aplicação principal |
| style.css | Estilos da rede social |
| script.js | Funcionalidades principais |
| firebase-config.js | Conexão com Firebase |
| login.html | Tela de login |
| cadastro.html | Tela de cadastro |
| auth.css | Estilos de autenticação |
| auth.js | Cadastro e autenticação |
| firestore.rules | Regras do banco de dados |
| storage.rules | Regras de armazenamento |
| 404.html | Página não encontrada |

## Configuração do Firebase

1. Crie ou abra o projeto Firebase.
2. Habilite Authentication com E-mail/senha.
3. Crie o Firestore Database.
4. Habilite o Firebase Storage, se disponível no plano.
5. Configure as regras de segurança.
6. Cadastre o domínio do GitHub Pages em Authentication > Authorized domains.

## Publicação

O projeto pode ser publicado pelo GitHub Pages.

Em Settings > Pages:
- Source: Deploy from a branch
- Branch: main
- Folder: / (root)

## Observação

Antes de disponibilizar a plataforma ao público, teste o cadastro, login, publicação, upload de imagens, curtidas, comentários e conversas usando duas contas diferentes.

A implementação de notificações automáticas e o reforço de segurança para operações simultâneas ainda precisam ser concluídos.
