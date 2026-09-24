# T011 - Papéis do círculo

## Objetivo
Completar owner/admin/member sem conceder UPDATE direto de roles ao cliente.

## Segurança
- chamada autenticada por JWT;
- função valida o usuário com Auth;
- somente owner pode alterar papel;
- owner não consegue alterar o próprio papel;
- papel owner nunca é atribuível/removível por esta função;
- somente admin/member são aceitos;
- secret/service role existe apenas na Edge Function.

## Escopo
- owner promove member para admin;
- owner rebaixa admin para member;
- admin continua podendo gerar convites, conforme regra já existente;
- UI reflete a mudança imediatamente.

## Fora deste bloco
- transferência de propriedade.
