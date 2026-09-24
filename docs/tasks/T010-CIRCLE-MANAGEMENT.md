# T010 - Gestão básica de círculos

## Objetivo
Fechar uma lacuna da V0.1: permitir que usuários gerenciem a própria participação no círculo sem mexer no pipeline de localização.

## Escopo entregue
- tela dedicada de gerenciamento por círculo;
- lista de membros com nome, papel e data de entrada;
- owner pode remover membros não-owner;
- membro/admin pode sair voluntariamente;
- owner não pode sair sem transferência de propriedade;
- remoção usa a policy RLS já existente;
- apagar membership remove automaticamente sharing por FK ON DELETE CASCADE;
- nenhum outro círculo é afetado.

## Fora deste bloco
- promover/rebaixar admin;
- transferir propriedade;
- avatar;
- realtime de entrada/saída de membros.

## Critérios de teste
1. owner abre Gerenciar círculo e vê a lista;
2. owner não vê botão de remoção em si mesmo;
3. segundo membro entra por convite;
4. owner consegue remover o segundo membro;
5. segundo membro entra novamente;
6. segundo membro consegue sair sozinho;
7. sharing do membro removido/saiu desaparece junto;
8. demais círculos permanecem intactos.
