# T019 - Hardening do leitor de histórico

## Problema
O projeto hospedado apresentava drift: `public.get_circle_history` estava marcado como `SECURITY DEFINER`, embora o desenho esperado fosse manter somente o helper privado nessa fronteira privilegiada.

## Correção
- `public.get_circle_history` volta explicitamente para `SECURITY INVOKER`;
- `public` e `anon` não podem executar a RPC;
- `authenticated` mantém acesso;
- nenhuma assinatura, retorno ou regra funcional foi alterada.

## Validação
O Security Advisor do Supabase deixou de reportar o alerta de função `SECURITY DEFINER` exposta a usuários autenticados após a migration.
