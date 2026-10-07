# 0001 — Licença MIT

- Status: aceita
- Data: 2026-10-07

## Contexto
O Kobi é open source e gratuito, sem plano de comercialização. A escolha da licença estava pendente (MIT/Apache 2.0 ou GPL) e precisava ser feita antes da primeira contribuição externa. O projeto prefere dependências com licenças permissivas, e a extensão GNOME precisa ser GPL para ser aceita no site oficial de extensões.

## Decisão
O projeto usa a **licença MIT** (arquivo `LICENSE` na raiz), que vale para o app, os pacotes, o serviço de voz e a documentação.

A exceção é a **extensão GNOME** (`extensions/gnome/`): ela é distribuída sob **GPL-2.0-or-later**, com o próprio arquivo de licença na pasta. Ela é um componente separado, que se comunica com o app só por IPC, então a GPL não se estende ao resto do código.

## Consequências
- Qualquer pessoa pode usar, modificar e redistribuir o Kobi, inclusive em projetos fechados, desde que mantenha o aviso de copyright.
- Compatível com as dependências permissivas (MIT, Apache 2.0, BSD). Dependências GPL não podem entrar no app sem rever esta decisão.
- Diferente da Apache 2.0, a MIT não traz concessão explícita de patentes; isso foi aceito por ser mais simples e mais comum no ecossistema JavaScript.
- Contribuições externas passam a ser aceitas sob a mesma licença.
