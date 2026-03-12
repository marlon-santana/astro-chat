Design Doc — AI Help Chat para ERP Educacional

1. Objetivo

Criar um chat de ajuda com IA integrado ao ERP que permita que usuários façam perguntas sobre fluxos e regras do sistema em vez de procurar manualmente a documentação.

Exemplo:

Usuário pergunta:

"Como registrar a frequência de um aluno?"

A IA responde:

Acesse o menu Turmas

Clique em Frequência

Selecione a turma

Marque presença ou falta

Clique em Salvar

Baseado nas documentações existentes no:

Tango

Confluence (Jira)

2. Requisitos
   Funcionais

Chat integrado ao ERP

IA responde perguntas sobre fluxos

Busca em documentação existente

Respostas em português

Retornar passo a passo estruturado

Exibir screenshots quando disponíveis

Não Funcionais

Custo zero

Executar localmente ou em servidor interno

Latência aceitável (<3s)

Fácil atualização das documentações

3. Arquitetura da Solução

Arquitetura baseada em RAG (Retrieval Augmented Generation).

Fluxo:

Usuário
↓
Chat React (ERP)
↓
API Node.js
↓
Busca vetorial (documentação)
↓
LLM local gera resposta
↓
Resposta formatada
↓
React mostra no chat 4. Stack Tecnológica (100% gratuita)
Frontend

React (já existente no ERP)

Context API ou React Query

UI do chat

Bibliotecas sugeridas:

react-markdown
react-chat-ui
Backend

Node.js

Bibliotecas:

express
langchain
chromadb
LLM (custo zero)

Rodar localmente com:

Opção 1 (recomendada)

Ollama

Modelos sugeridos:

llama3

mistral

phi3

Banco Vetorial

Armazenar embeddings das documentações.

Opções gratuitas:

Chroma

ou

FAISS

5. Estrutura do Projeto
   ai-help-service

/src
/controllers
chatController.js

/services
ragService.js
embeddingService.js

/repositories
vectorRepository.js

/loaders
confluenceLoader.js
tangoLoader.js

/scripts
ingestDocs.js

/utils
promptBuilder.js

/server.js 6. Ingestão das Documentações

Script que transforma as documentações em base de conhecimento da IA.

Fontes:

Export HTML/PDF do Confluence

Export do Tango

Processo:

docs/
fluxo_matricula.md
fluxo_frequencia.md
fluxo_financeiro.md
Script de ingestão
node scripts/ingestDocs.js

Fluxo:

documento
↓
chunking
↓
embedding
↓
vector database 7. Chunking da Documentação

Cada documento é dividido em blocos menores.

Exemplo:

Título: Registrar Frequência

Passo 1:
Abrir menu Turmas

Passo 2:
Selecionar Frequência

Chunk size:

500 tokens 8. Fluxo de Pergunta do Usuário
Passo 1

Usuário pergunta no chat.

Como registrar frequência?
Passo 2

API recebe:

POST /chat

Body:

{
"question": "Como registrar frequência?"
}
Passo 3

Backend gera embedding da pergunta.

Passo 4

Busca vetorial:

top 3 documentos mais relevantes
Passo 5

Prompt enviado para LLM.

9. Prompt da IA

Prompt estruturado para respostas consistentes.

Exemplo:

Você é um assistente de suporte de um ERP educacional.

Responda usando apenas a documentação fornecida.

Explique sempre em passos numerados.

Se não souber a resposta diga:
"Não encontrei essa informação na documentação."

DOCUMENTAÇÃO:

{context}

PERGUNTA:

{question} 10. Controller
POST /chat

Responsabilidade:

receber pergunta

chamar service

retornar resposta

11. Service (RAG)

Responsável por:

1 gerar embedding
2 buscar docs relevantes
3 montar prompt
4 chamar LLM

12. Exemplo de Resposta da IA

Resposta esperada:

Para registrar a frequência de alunos:

1. Acesse o menu "Turmas"
2. Clique em "Frequência"
3. Escolha a turma desejada
4. Marque presença ou falta
5. Clique em "Salvar"

Dica:
Você pode registrar frequência em lote usando o botão "Marcar todos". 13. Componente React do Chat

Novo componente no ERP:

<AIHelpChat />

Integrado ao botão de ajuda existente.

Fluxo:

botão ajuda
↓
abre modal
↓
chat IA
Estrutura do componente
components
AIHelpChat
ChatWindow.jsx
MessageBubble.jsx
useChat.js 14. Exemplo de Hook
function useChat() {

const sendMessage = async (message) => {

const response = await fetch('/api/chat', {
method:'POST',
body: JSON.stringify({question: message})
})

}

} 15. Atualização da Base de Conhecimento

Sempre que nova documentação for criada:

npm run ingest-docs

Isso atualiza a base vetorial.

16. Segurança

remover dados sensíveis da documentação

limitar tamanho da pergunta

rate limit

17. Melhorias Futuras
    1 Chat contextual

Memória da conversa.

2 Integração direta com Confluence API

Buscar docs automaticamente.

3 Mostrar screenshots

Retornar imagens do fluxo.

4 Deep links

Resposta com links diretos do ERP.

Exemplo:

Clique aqui para abrir a tela:
erp.com/turmas/frequencia 18. Estimativa de Desenvolvimento

MVP:

2 a 4 dias

Divisão:

backend RAG → 1 dia

ingest docs → 1 dia

chat React → 1 dia

ajustes → 1 dia

19. Resultado Final

Usuário pergunta:

Como fazer matrícula de aluno?

IA responde com:

passo a passo
links
dicas

Sem precisar abrir:

Tango

Confluence

💡 Observação importante:
Como você já trabalha bastante com React + Node no ERP, essa arquitetura encaixa perfeitamente no seu padrão Controller / Service / Repository que você costuma usar.

Se quiser, eu também posso te mostrar uma arquitetura ainda melhor (usada por empresas grandes) que permite:

IA entender prints das telas do ERP

responder muito mais preciso

custando 0 reais

É basicamente o mesmo sistema que empresas usam para AI copilots internos de produto.
