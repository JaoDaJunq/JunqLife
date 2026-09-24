# T001 - Fundação

## Objetivo
Preparar o projeto para desenvolvimento sem implementar ainda UI final nem tracking de produção.

## Entregáveis
- estrutura do repositório;
- documentação de arquitetura;
- migration inicial do banco;
- RLS inicial;
- contrato de ingestão de localização;
- plano de testes de autorização;
- decisão registrada sobre Traccar SDK e ausência de Traccar Server na V0.1.

## Critérios de aceite
- todas as tabelas `public` com RLS;
- usuário não consegue ler localização de usuário fora de círculo compartilhado;
- usuário não consegue escrever posição diretamente nas tabelas de GPS;
- desligar `sharing_enabled` bloqueia leitura por outro membro;
- owner de um círculo é automaticamente criado como membro owner;
- PostGIS instalado fora de `public` em projeto novo;
- nenhuma secret/service key em frontend.

## Revisão obrigatória
T001 precisa ser revisada antes de T004, porque erros aqui afetam privacidade de localização.
