# T009 - Map interaction pass

## Problema
O mapa estava dentro do mesmo ScrollView vertical dos cards. No Android, o gesto vertical podia ser capturado pela página em vez do MapLibre, deixando pan/zoom com sensação de mapa travado.

## Alterações
- mapa removido do ScrollView de detalhes;
- detalhes passam a rolar em uma área separada abaixo do mapa;
- pan, pinch zoom, double tap, rotação e pitch explicitamente habilitados;
- render alvo de 60 FPS;
- controles de zoom + e -;
- botão "Você" recentraliza na posição atual;
- botão "Grupo" enquadra membros e Places;
- bússola nativa habilitada;
- criação de Place mudou de toque simples para long press;
- dica visual explica o long press sem bloquear o mapa.

## Critérios de teste
1. arrastar mapa livremente em todas as direções sem rolar os cards;
2. pinch-to-zoom;
3. double tap zoom;
4. zoom + e -;
5. botão Você;
6. botão Grupo;
7. long press cria apenas o marcador de Place;
8. toque/arraste comum não cria Place.
