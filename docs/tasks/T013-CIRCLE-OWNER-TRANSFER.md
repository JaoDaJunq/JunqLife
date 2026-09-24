# T013 - Transferência de Owner

## Objetivo
Permitir que o owner transfira a propriedade antes de sair do círculo sem risco de estado parcial.

## Banco
A transferência ocorre dentro de uma função PostgreSQL transacional:
- valida owner atual;
- exige que o novo owner já seja membro;
- rebaixa o owner atual para member;
- promove o novo owner para owner;
- atualiza circles.owner_id;
- toda a operação é atômica.

A função é SECURITY DEFINER, porém EXECUTE é revogado de PUBLIC, anon e authenticated. Somente service_role pode chamá-la.

## Edge Function
- verify_jwt=true;
- valida o usuário no Auth;
- nunca recebe o ID do owner atual do cliente;
- usa auth.user.id como owner atual;
- service role existe somente no servidor.

## App
- owner vê ação "Transferir owner" nos demais membros;
- confirmação deixa claro que o owner atual continua como membro;
- UI atualiza os dois papéis e owner_id imediatamente;
- depois da transferência o antigo owner pode sair normalmente.

## Verificação
A função foi testada no círculo de teste com um segundo membro dentro de BEGIN/ROLLBACK. O novo usuário virou owner, o antigo virou member e circles.owner_id acompanhou a mudança.
