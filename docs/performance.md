# Performance

O Kobi fica aberto o dia todo, ao lado de IDEs, navegadores e chamadas de vídeo.

## Prioridades (em ordem)

1. **Experiência:** qualidade de imagem máxima, movimentos sempre fluidos, fala e escuta sem travamentos nem atrasos perceptíveis.
2. **Não atrapalhar o trabalho:** uso de CPU e GPU baixo o bastante para nunca deixar a IDE, o navegador ou uma chamada de vídeo lentos.
3. **Memória:** recurso abundante nas máquinas de desenvolvedores (16 GB ou mais). Até **~1 GB** é aceitável quando isso garante qualidade e resposta imediata.

Ou seja: gastar memória para ganhar qualidade e velocidade é aceitável; gastar CPU/GPU de forma contínua, não. Quando houver conflito, a qualidade só é reduzida para preservar a fluidez — nunca para economizar memória.

## Orçamento de desempenho (metas iniciais)

Medidos no ambiente de referência (notebook Ryzen 7, 16 GB, Fedora/GNOME, três monitores). Ajustar com dados reais da Fase 1.

| Situação | CPU | Memória total (app + voz, sem IA local) | Fluidez |
|---|---|---|---|
| Visível, flutuando | baixo (< 5%) | até ~1 GB | 60 fps estáveis, quadro < 16 ms |
| Arrastando / animando | < 10% | — | 60 fps sem quedas |
| Escuta contínua | < 3% adicional | — | ativação percebida em < 300 ms |
| Resposta de voz | picos curtos | modelos já residentes | início da fala o mais rápido possível (streaming) |
| Oculto, tela cheia ou tela bloqueada | ~0% de render | — | renderização pausada |

Quedas de quadros e travamentos são tratados como bugs. Regressões bloqueiam o merge (benchmarks na CI quando possível).

## Renderização

- **Qualidade máxima por padrão:** supersampling 3× (o padrão aprovado no protótipo v6) e 60 fps sempre que o Kobi estiver visível.
- **Qualidade adaptativa só como proteção da fluidez:** se o tempo de quadro passar do limite (máquina mais fraca, GPU ocupada), reduzir temporariamente o supersampling para manter os 60 fps, e voltar ao máximo assim que possível.
- **Janela do tamanho do Kobi**, nunca um canvas transparente cobrindo todos os monitores: o Kobi se move movendo a janela. Isso reduz o custo de GPU sem perder nenhuma qualidade.
- Renderização **pausada** apenas quando o Kobi não pode ser visto (oculto, app em tela cheia, tela bloqueada).
- Iluminação de ambiente pré-calculada uma vez; materiais e geometrias reutilizados; sem alocação de objetos por quadro.
- Considerar suavização temporal para movimentos e oclusão ambiente em tempo real, desde que caibam no orçamento de quadro.

## Electron

- Overlay leve e sempre pronto; janela de configurações criada sob demanda.
- Lógica do "cérebro" em processo utilitário, separada do renderer do avatar, para que nada da lógica atrase um quadro.
- Sem vazamentos de memória, listeners ou timers (testes de longa duração: o Kobi precisa estar igual após dias aberto).

## Latência de conversa (requisito de experiência)

O Kobi precisa reagir mais rápido que assistentes de celular. Metas:

| Momento | Meta |
|---|---|
| Fim de "Hey Kobi" → olhos em modo "ouvindo" | ≤ 200 ms |
| Palavras ditas logo após a ativação | nenhuma perdida (pré-gravação) |
| Fim da fala do usuário → primeira reação audível | ≤ 300–500 ms |
| Resposta resolvida localmente (skill/memória) | completa em < 500 ms |
| Resposta com IA → início da resposta real | o mais cedo possível, com o vazio coberto por reação imediata |

Técnicas:
- **Detecção contínua com áudio em buffer circular:** o microfone já está sendo lido; ao detectar a ativação, a gravação começa a partir do buffer, então frases ditas "de uma vez" ("Hey Kobi, que horas é a reunião?") não perdem palavras. **Privacidade:** o buffer fica só na memória, guarda poucos segundos e é sobrescrito continuamente; nada é gravado em disco nem enviado a lugar nenhum antes da ativação.
- **Reação visual imediata:** a mudança de expressão é local e instantânea, antes de qualquer outro processamento.
- **Transcrição em streaming:** transcrever enquanto o usuário fala, para o texto estar pronto quando ele terminar.
- **Detecção de fim de fala (VAD, ex.: Silero)** com pausa ajustável e adaptativa: mais curta quando a frase parece completa.
- **Reação imediata enquanto pensa:** ao fim da fala, uma classificação rápida e local da intenção escolhe uma reação curta do banco de falas ("Hmm, deixa eu ver…", "Boa pergunta!", "Já vou olhar sua agenda"), na personalidade e no idioma certos, com **áudio pré-sintetizado em cache** (latência quase zero), junto com a expressão "pensando".
- **Atualizações de progresso** em esperas longas ("tô pesquisando… achei umas coisas interessantes").
- **Resposta em streaming:** a IA gera em fluxo; o texto é quebrado em frases; cada frase vai para a síntese de voz assim que fica pronta.
- **Variedade e bom senso:** sem repetir sempre a mesma reação; quando a resposta é instantânea (local), não há preenchimento.
- **Interrupção (barge-in):** o usuário pode falar por cima do Kobi; com cancelamento de eco, ele para e escuta.

## Voz

- **Modelos residentes em memória** (transcrição e síntese carregados na inicialização ou no primeiro uso, e mantidos), para resposta imediata. Memória é um custo aceito aqui.
- Usar o modelo de transcrição de melhor precisão que caiba no orçamento de latência (ex.: Whisper small/medium quantizado), em vez do menor possível.
- Escuta contínua com modelo de ativação leve + detecção de atividade de voz antes da transcrição.
- Síntese em streaming: o Kobi começa a falar antes de a frase inteira estar pronta.
- Processamento de áudio em threads próprias, sem disputar com a renderização.

## Cérebro e dados

- Orientado a eventos; sem polling constante.
- SQLite com índices; memórias relevantes em cache.
- Tarefas pesadas (consolidação de memória) em momentos ociosos e em baixa prioridade.
- IA local (Ollama) é opcional e roda fora do app.

## Modo econômico (opcional)

Desligado por padrão. Pode ser ativado manualmente ou configurado para ligar na bateria: 30 fps, supersampling 2×, palavra de ativação desligada, iniciativa reduzida.

## Medição

- Painel de diagnóstico opcional (fps, tempo de quadro, latência de voz, CPU, memória por processo).
- Benchmarks reproduzíveis por fase, registrados nas specs.
- Se o Electron se mostrar um limitador real de fluidez, a camada de apresentação isolada permite avaliar outra casca sem reescrever o núcleo.
