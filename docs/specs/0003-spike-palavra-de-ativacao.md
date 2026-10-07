# 0003 — Spike: palavra de ativação "Hey Kobi"

- Fase: 1
- Status: rascunho

## Objetivo
Descobrir se um modelo "Hey Kobi" treinado com openWakeWord atinge, no ambiente do Wellington, a precisão, a latência e o consumo de CPU de que a escuta contínua precisa, e se ele pode ser distribuído com o Kobi sob uma licença compatível. O resultado é um ADR com a decisão (seguir com openWakeWord, ajustar o treino ou trocar de abordagem) antes da Fase 3.

## Comportamento
- Um script de spike em `services/voice` lê o microfone continuamente e imprime, com horário, cada detecção de "Hey Kobi" e a confiança.
- O áudio fica só na memória, num buffer circular de poucos segundos, sobrescrito continuamente. Nada é gravado em disco nem enviado a lugar nenhum, exceto as amostras de teste que o Wellington gravar de propósito (`docs/performance.md`).
- Treino do modelo pelo processo oficial do openWakeWord (Colab ou local), com amostras sintéticas de "Hey Kobi" nas vozes e idiomas do projeto (pt, en, es e, se der, fr).
- Avaliar também o ajuste pessoal previsto em `docs/decisoes.md`: 3 a 5 gravações do Wellington, calibração do limiar e verificador personalizado (*custom verifier*).

## Medições

| Métrica | Meta |
|---|---|
| Detecções corretas (Wellington, distância normal do microfone, ambiente silencioso e com ruído de escritório) | ≥ 95% |
| Ativações falsas em conversa normal, vídeo, música e reunião ao fundo | < 0,5 por hora |
| Fim de "Hey Kobi" → evento de detecção | ≤ 200 ms (meta da reação "ouvindo") |
| CPU adicional da escuta contínua | < 3% |
| Memória do processo | registrar |

- Testar com o microfone do notebook e com o headset que o Wellington usa no dia a dia.
- Testar com a frase dita "de uma vez" ("Hey Kobi, que horas é a reunião?") para confirmar que o buffer guarda o começo da fala seguinte.
- Comparar o modelo genérico com o modelo com ajuste pessoal.

## Licenças (bloqueante)
- O código do openWakeWord é Apache 2.0, mas os **modelos pré-treinados distribuídos com ele são CC BY-NC-SA 4.0** (por causa dos dados de treino). Eles **não podem** ir no Kobi, que é MIT.
- O modelo "Hey Kobi" próprio só pode ser distribuído se todos os dados e modelos usados no treino permitirem: vozes sintéticas (TTS), bases de áudio negativo (fala, ruído, música) e o modelo de embeddings. Cada um entra numa tabela no ADR, com licença e link.
- Se algum dado necessário for não comercial ou proibir redistribuição, o ADR registra a alternativa: trocar a base, treinar só no computador do usuário (o modelo não é distribuído) ou mudar de ferramenta.

## Riscos a verificar
- Compatibilidade do openWakeWord e do runtime de inferência (ONNX Runtime) com o Python 3.14 do projeto.
- Captura de áudio no Fedora com PipeWire, pela PortAudio (`portaudio-devel` já instalado).
- Desempenho dos sotaques em pt e es, já que boa parte dos dados de treino públicos é em inglês.

## Fora do escopo
- Transcrição, síntese de voz, VAD, cancelamento de eco e o protocolo com o app (Fase 3).
- Tela de treino pessoal no app; aqui o treino é por script.
- Verificação de locutor ("voice match").

## Critérios de aceite
- [ ] Modelo "Hey Kobi" treinado e rodando em escuta contínua no notebook do Wellington.
- [ ] Tabela de medições preenchida (modelo genérico e com ajuste pessoal).
- [ ] Tabela de licenças de tudo o que entra no modelo, com conclusão sobre a distribuição.
- [ ] ADR com a decisão sobre a palavra de ativação.
- [ ] Os pipelines continuam passando (o script de spike não quebra lint, tipos nem cobertura).

## Desempenho
Mede a linha "Escuta contínua" de `docs/performance.md` (< 3% de CPU, ativação percebida em < 300 ms) e a meta de latência "Fim de 'Hey Kobi' → olhos em modo 'ouvindo'" (≤ 200 ms).
