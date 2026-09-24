# Visão Geral

## Objetivo
Criar o JunqLife, um app privado de localização compartilhada entre pessoas que aderiram voluntariamente a um círculo.

## Não objetivos da V0.1
- detectar acidentes;
- reconstruir rotas complexas;
- sistema de mensagens;
- tracking invisível;
- painel administrativo público;
- integração com rastreadores automotivos.

## Princípios
1. Consentimento explícito para compartilhar localização.
2. Compartilhamento pode ser desligado pelo usuário.
3. Privilégio mínimo no banco.
4. Nenhuma service role no app.
5. Localização acessível somente entre membros autorizados de um mesmo círculo.
6. Tracking mobile reaproveita Traccar Client SDK em vez de reimplementar background GPS.
7. Histórico é separado da posição atual para permitir retenção e limpeza independentes.

## Primeiro marco funcional
- Usuário A e B autenticados;
- ambos entram no mesmo círculo;
- ambos habilitam compartilhamento;
- A vê B no mapa;
- B vê A no mapa;
- posição atualiza sem expor usuários de outros círculos.
