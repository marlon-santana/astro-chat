# Feature: Vínculo de Turma — Filtro

## Descrição

A funcionalidade **Vínculo de Turma - Filtro** permite visualizar e filtrar os vínculos de turmas associados a um professor.
Operador pode ver todos os vínculos e filtrá-los por status: `Ativos`, `Inativos`, `Encerrados`.
Disponível na área de edição do professor.

---

## Localização da funcionalidade

**Caminho no sistema**

- Área de Professores → Editar Professor → Aba "Vínculo de turma"

Nesta aba o operador consegue:

- Visualizar todas as turmas vinculadas ao professor.
- Filtrar os vínculos por status (Ativos, Inativos, Encerrados).

**Protótipo de interface**

- Figma: https://www.figma.com/file/3j1a9CJmeZa2askdevZq6l/RH---V1
- Node da tela: `node-id=4659-5629`

---

## Comportamento Esperado (Resumo)

- Mostrar lista de turmas vinculadas a um professor.
- Possibilitar filtros por status (Ativos, Inativos, Encerrados).
- Em cada turma exibir indicadores de quantidade de vínculos ativos e inativos.
- Edição/exclusão de vínculo é feita via disciplina (não pela turma).

---

## Regras de Negócio

- **RNFV001 — Visualização de vínculos**
  - O sistema deve permitir visualizar vínculos de turmas com os seguintes status: `Ativos`, `Inativos`.

- **RNFV002 — Definição de vínculo ativo**
  - Um vínculo é considerado ativo quando:
    - Está atualmente em vigor;
    - Ainda irá acontecer;
    - Nunca foi inativado manualmente.
  - Mesmo que a disciplina ou a turma estejam encerradas, o vínculo permanece ativo se nunca foi inativado manualmente.

- **RNFV003 — Definição de vínculo inativo**
  - Um vínculo é considerado inativo quando foi inativado manualmente pelo operador.

---

## Regras de Interface

- **RIFV001 — Indicadores de vínculos**
  - Dentro do accordion de cada turma, devem existir indicadores visuais que mostram:
    - Quantidade de vínculos ativos
    - Quantidade de vínculos inativos
  - Representação visual:
    - 🟢 Verde — Vínculos ativos
    - 🔴 Vermelho — Vínculos inativos
  - Se não houver vínculos, o indicador mostra `0`.

- **RIFV002 — Exclusão de vínculo**
  - Não é permitido excluir um vínculo diretamente pela turma.
  - Para editar ou remover um vínculo, o operador deve entrar na edição da disciplina e editar o vínculo por meio da disciplina.

- **RIFV003 — Botão de edição de vínculo**
  - O botão **Editar vínculo** deve estar localizado ao lado do título da turma.
  - Objetivo: facilitar o acesso à edição do vínculo (anteriormente aparecia apenas dentro do accordion em um menu).

---

## Contexto da Feature

- Projeto: **Projeto Refactoring**
- Módulo: **Gestão de Professores**

**Responsáveis**

- UX/UI: Nina Brayner
- Product Owner: Lidiane Passos

---

## Perguntas que esta documentação responde (útil para RAG)

- **Como visualizar os vínculos de turmas de um professor?**
  - Acesse Área de Professores → Editar Professor → Aba Vínculo de Turma.

- **Quais tipos de vínculos podem ser visualizados?**
  - Ativos, Inativos, Encerrados.

- **O que define um vínculo ativo?**
  - Um vínculo ativo é aquele que nunca foi inativado manualmente, mesmo que a turma ou disciplina estejam encerradas.

- **Como saber quantos vínculos ativos existem em uma turma?**
  - No accordion da turma, existem indicadores: Verde → vínculos ativos; Vermelho → vínculos inativos.

- **É possível excluir um vínculo diretamente pela turma?**
  - Não. A edição ou exclusão do vínculo deve ser feita pela disciplina.

---

## Observações para indexação/RAG

- Documentar termos exatos (`Vínculo de Turma`, `Ativos`, `Inativos`, `Encerrados`) ajuda no chunking e corresponder perguntas curtas.
- Mantenha trechos curtos (< 300 palavras) por bloco; evite linguagem muito narrativa.
- Inclua links e node-id do protótipo para referência direta em respostas que necessitem imagem ou fluxo de UI.

---

_Arquivo gerado para uso em pipelines de ingestão, embeddings e RAG._
