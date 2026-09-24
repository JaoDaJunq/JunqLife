# T007 - Places V0.3A

## Objetivo
Adicionar locais salvos por círculo sem alterar o pipeline de tracking.

## Escopo entregue
- listar locais do círculo;
- owner salva um local usando uma posição visível como centro;
- raio configurável entre 25 m e 5 km;
- locais e raio aparecem no mapa nativo;
- membros do círculo visualizam os locais;
- owner pode excluir;
- RLS existente continua sendo a fronteira de autorização.

## Fora deste commit
- seleção livre por toque no mapa;
- eventos de entrada/saída;
- notificações;
- avaliação de geofence em background.

## Critério de teste
1. abrir círculo com pelo menos uma posição visível;
2. owner seleciona membro;
3. salvar local com nome e raio;
4. conferir marcador + área circular;
5. atualizar tela e confirmar persistência;
6. excluir e confirmar remoção.
