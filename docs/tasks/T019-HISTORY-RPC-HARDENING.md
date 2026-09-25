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


## Resultado da regressão
A tentativa de tornar a RPC pública `SECURITY INVOKER` exigia liberar execução direta do helper privado para `authenticated`, quebrando a barreira coberta pela suíte pgTAP. A mudança foi revertida.

O desenho final mantém:
- `public.get_circle_history` como único entrypoint autenticado;
- helper privado sem `EXECUTE` para `authenticated`;
- helper endurecido com `p_viewer_id = auth.uid()`;
- testes de regressão como fonte de verdade para a fronteira de permissão.

O aviso genérico do Security Advisor sobre a RPC pública `SECURITY DEFINER` é esperado neste desenho e deve ser revisado junto aos testes, não removido concedendo acesso ao helper privado.
