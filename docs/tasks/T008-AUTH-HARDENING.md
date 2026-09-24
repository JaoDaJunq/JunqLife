# T008 - Auth session hardening

## Problema observado
Após apagar um usuário no Supabase, o APK podia continuar confiando na sessão persistida localmente. O tracking também podia manter uma credencial de device criada para a conta apagada.

## Correções
- sessão persistida usa uma nova storage key para iniciar limpo nesta fase de testes;
- bootstrap chama `auth.getUser()` para confirmar que o usuário ainda existe no servidor;
- sessão inválida é descartada localmente;
- credencial nativa de tracking passa a armazenar o `user_id`;
- credenciais legadas ou pertencentes a outra conta são descartadas antes de registrar um novo device.

## Pendência administrativa
O Auth do projeto ainda precisa ter Site URL e Redirect URLs configurados para:
`https://jaodajunq.github.io/JunqLife/`

Os logs do Auth ainda mostram `localhost:3000` como destino configurado.
