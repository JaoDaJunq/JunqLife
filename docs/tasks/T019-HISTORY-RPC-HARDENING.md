# T019 - Hardening do leitor de histórico

## Problema
O projeto hospedado apresentava drift: `public.get_circle_history` estava marcado como `SECURITY DEFINER`, embora o desenho esperado fosse manter somente o helper privado nessa fronteira privilegiada.

## Correção
- `public.get_circle_history` volta explicitamente para `SECURITY INVOKER`;
- `public` e `anon` não podem executar a RPC;
- `authenticated` mantém acesso;
- o wrapper recebe `USAGE` mínimo sobre o schema privado para alcançar o helper;
- o helper valida explicitamente `p_viewer_id = auth.uid()`, impedindo impersonação do viewer;
- nenhuma assinatura ou retorno público foi alterado.

## Validação
O Security Advisor do Supabase deixou de reportar o alerta de função `SECURITY DEFINER` exposta a usuários autenticados após a migration.
