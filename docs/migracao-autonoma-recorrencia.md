# Feature: Migração Autônoma para Recorrência

## Visão Geral

A funcionalidade **Migração Autônoma para Recorrência** permite que alunos solicitem a mudança do meio de pagamento de boleto para pagamento por recorrência (cartão com cobrança automática) diretamente no portal do aluno.

Objetivos:

- Simplificar a jornada do aluno.
- Dar autonomia na gestão da forma de pagamento.
- Reduzir dependência de processos administrativos.

Problema anterior:

- Troca manual dependente de secretaria e financeiro.
- Processo demorado, pouco transparente e dependente de múltiplas áreas.

---

## Fluxo da Feature

1. **Início da solicitação**
   - Aluno acessa Portal do Aluno → Financeiro → Gerenciar Pagamentos.
   - Se meio atual = boleto, exibe botão **Ativar Pagamento Automático**.

2. **Confirmação da solicitação**
   - Modal explica condições e próximos passos.
   - Aluno clica **Solicitar ativação** para confirmar.

3. **Análise da solicitação**
   - Solicitação é registrada e enviada ao time financeiro.
   - Status exibido em **Minhas solicitações**: _Em análise, Deferido, Indeferido, Cancelado_.

4. **Cadastro do cartão**
   - Se deferida, aluno cadastra cartão via link para a operadora (Getnet).
   - Após cadastro, pagamento recorrente é ativado e cartão fica registrado.

5. **Finalização**
   - Forma de pagamento é atualizada para _Recorrência_.
   - Portal exibe **Editar cartão cadastrado** e mensagem de sucesso.
   - Para mudar a forma de pagamento no futuro, aluno deve procurar a secretaria.

---

## Regras de Negócio

- **RNB001 — Elegibilidade**
  - A migração só é oferecida quando o meio atual for boleto.

- **RNB002 — Registro de solicitação**
  - Toda solicitação gera um registro com histórico e status atual.

- **RNB003 — Aprovação financeira**
  - Somente após análise e deferimento pelo financeiro o aluno poderá cadastrar cartão.

- **RNB004 — Validade da solicitação**
  - Se o aluno não cadastrar o cartão em X dias após deferimento, a solicitação é cancelada automaticamente.

---

## Regras de Interface — Financeiro

- **RIMT001 — Abas da área Financeira**
  - Abas fixas: `Meus Títulos` (default) e `Gerenciar Pagamentos`.

- **RIMT002 — Aviso após aprovação**
  - Ao aprovar, exibir aviso acima da tabela em _Meus Títulos_ com o botão **Cadastrar Cartão de Crédito**.

---

## Interface — Gerenciar Pagamentos

- **RIGP001 — Estrutura da tela**
  - Exibir dois cards: `Benefícios da Recorrência` e `Informações do Curso`.

- **RIGP002 — Card de informações do curso**
  - Mostrar: nome do curso, status da matrícula, meio de pagamento atual, data de contratação, próxima cobrança.
  - Exibir botão **Ativar Pagamento Automático** apenas quando meio atual = boleto.

- **RIGP003 — Modal de confirmação**
  - Exibir modal quando clicar em **Ativar Pagamento Automático**.

- **RIGP004 — Confirmação da solicitação**
  - Após confirmar, exibir toast: "Solicitação enviada com sucesso! Acompanhe o andamento em 'Minhas solicitações'."

- **RIGP005 — Criação da seção "Minhas Solicitações"**
  - Após envio, desabilitar botão e mostrar seção com: data, status (inicial: _Em análise_) e mensagem: "Estamos analisando seus dados...".

- **RIGP006 — Status Indeferido**
  - Exibir status _Indeferido_ com motivo informado pelo financeiro.

- **RIGP007 — Status Deferido**
  - Exibir status _Deferido_ e mensagem: "Solicitação aprovada! Cadastre seu cartão para ativar o pagamento automático."
  - Liberar botão **Cadastrar Cartão de Crédito**.

- **RIGP008 — Sucesso após cadastro do cartão**
  - Exibir toast: "Cartão cadastrado com sucesso."

- **RIGP009 — Atualização da forma de pagamento**
  - Após ativação, forma passa a ser _Recorrência_ e exibe opção **Editar cartão cadastrado**.
  - Exibir mensagem: "Pronto! O pagamento automático está ativado."

- **RIGP010 — Múltiplas solicitações**
  - Exibir _Minhas Solicitações_ em formato accordion, ordenadas por data (mais recentes primeiro).

- **RIGP011 — Alunos com múltiplos cursos**
  - Exibir cursos como chips; ordenar: cursos ativos (alfabético), depois inativos (alfabético).

- **RIGP012 — Status Cancelado**
  - Se cancelado, mostrar status _Cancelado_ e motivo do financeiro.

---

## Protótipos de Interface

- Figma — Tela Meus Títulos
  - https://www.figma.com/design/dIVJHfMT6y1uNwIdxxnoAL/SqIP---HUB-de-Conectividade
  - node-id=12524-30807

- Figma — Tela Gerenciar Pagamentos
  - https://www.figma.com/design/dIVJHfMT6y1uNwIdxxnoAL/SqIP---HUB-de-Conectividade
  - node-id=12498-19865

---

## Perguntas e Respostas (Otimizado para RAG)

- **Como ativar pagamento automático no portal do aluno?**
  - Acesse: Financeiro → Gerenciar Pagamentos. Se o pagamento atual for boleto, clique em **Ativar Pagamento Automático**.

- **O que acontece após solicitar pagamento automático?**
  - A solicitação é enviada para análise do time financeiro e aparece em _Minhas Solicitações_ com status _Em análise_.

- **Quais são os status possíveis da solicitação?**
  - Em análise, Deferido, Indeferido, Cancelado.

- **O que acontece quando a solicitação é aprovada?**
  - O aluno poderá cadastrar um cartão de crédito (via Getnet) e ativar o pagamento recorrente.

- **Onde cadastrar o cartão de crédito?**
  - O aluno será redirecionado para a operadora Getnet para cadastrar o cartão.

- **O que acontece após cadastrar o cartão?**
  - Pagamento automático ativado; forma de pagamento atualizada para _Recorrência_; portal mostra opção para editar o cartão cadastrado.

---

_Arquivo gerado para uso em pipelines de ingestão, embeddings e RAG._
