# Segurança e Privacidade

## Regras obrigatórias
- `service_role` nunca entra no app.
- Toda tabela exposta usa RLS.
- `user_metadata` não decide autorização.
- Identidade em ingestão vem do JWT autenticado.
- Usuário não pode enviar localização em nome de outro usuário.
- Um usuário só enxerga localização de outro se existir ao menos um círculo compartilhado em que o alvo esteja com `sharing_enabled = true`.
- Parar compartilhamento deve bloquear leitura imediatamente, mesmo que a última posição permaneça armazenada.

## Dados sensíveis
Localização é tratada como dado altamente sensível. Evitar logs com latitude/longitude completas e nunca colocar coordenadas em mensagens de erro públicas.

## Histórico
Definir retenção antes de produção. Sugestão para MVP: 30 dias, configurável posteriormente.

## Exclusão
Ao remover um usuário do círculo, o acesso às posições daquele usuário deve desaparecer por RLS, sem depender de limpeza assíncrona.
