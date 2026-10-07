# kobi-voice

Serviço local de voz do Kobi, em Python: palavra de ativação, transcrição e fala. Roda como processo separado e conversa com o app por IPC local (mensagens JSON com schema versionado).

As camadas seguem `docs/engenharia.md` (domínio, aplicação, infraestrutura) e são criadas na Fase 3, junto com as funcionalidades.

## Desenvolvimento

```bash
uv sync
uv run pytest
uv run ruff check . && uv run ruff format --check .
uv run mypy
```
