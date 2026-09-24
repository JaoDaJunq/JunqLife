# Plano de testes RLS

Criar usuários A, B e C.

1. A cria círculo X; A vira owner automaticamente.
2. Confirmar que A também ganhou linha de sharing OFF.
3. A adiciona B como `member`; B ganha sharing OFF automaticamente.
4. C fica fora.
5. A e B habilitam o próprio sharing.
6. B tenta alterar `circle_members.role`: deve falhar porque não possui UPDATE.
7. A tenta adicionar membro já como admin/owner pela Data API: deve falhar pela policy.
8. A tenta inserir/alterar `current_locations` ou `location_history` diretamente pela Data API: deve falhar por falta de privilégio de escrita.
9. A registra um device próprio e chama `location-ingest`: deve aceitar a posição.
10. A chama `location-ingest` com `device_id` de B: deve falhar.
11. A envia `user_id` no JSON tentando representar B: deve ser ignorado; identidade vem do JWT.
12. B lê localização de A: permitido enquanto A compartilha no círculo comum.
13. C lê localização de A: deve retornar zero linhas/negado.
14. A desliga sharing no círculo X.
15. B tenta ler posição de A: deve deixar de receber a linha imediatamente.
16. Com sharing desligado, `location-ingest` de A deve rejeitar novas posições.
17. B ainda consegue ver o perfil de A por compartilhar círculo, sem receber GPS.
18. Remover B de X e confirmar que acesso de B a perfis/locations/places de X termina imediatamente.
19. Owner tenta remover a própria membership: deve falhar na V0.1.
