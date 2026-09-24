# T007 - Places V0.3A

## Objetivo
Adicionar locais salvos por círculo sem alterar o pipeline de tracking.

## Escopo entregue
- listar locais do círculo;
- owner salva um local usando uma posição visível como centro;
- owner pode tocar diretamente no mapa para escolher outro ponto;
- marcador temporário indica o ponto escolhido antes de salvar;
- raio configurável entre 25 m e 5 km;
- locais e raio aparecem no mapa nativo;
- mapa enquadra um Place mesmo quando não há membro visível;
- membros do círculo visualizam os locais;
- owner pode excluir;
- RLS existente continua sendo a fronteira de autorização.

## Fora deste commit
- eventos de entrada/saída;
- notificações;
- avaliação de geofence no ingest.

## Critério de teste
1. abrir um círculo;
2. owner toca em qualquer ponto do mapa;
3. conferir marcador temporário;
4. salvar local com nome e raio;
5. conferir marcador + área circular;
6. atualizar tela e confirmar persistência;
7. excluir e confirmar remoção.
