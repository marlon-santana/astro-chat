Ganho rápido (baixo esforço)

Melhorar o “retrieval”: hoje é só contagem de tokens. Troque por embeddings reais (ex.: all-MiniLM-L6-v2) e busca por similaridade (cosine). Isso aumenta muito a precisão.
Melhorar o chunking: reduzir para 200–300 palavras com sobreposição (overlap). Ajuda a pegar o trecho certo sem poluir o contexto.
Ajustar o prompt: hoje ele pede para “não copiar trechos” e “usar lista/tabela”, mas não define formato de resposta. Um template mais claro aumenta assertividade.
Impacto médio

Re-ranking: depois do topK por embedding, faça um re-ranking com LLM (ou um modelo cross-encoder leve).
Citação de fontes: ao responder, incluir “Fonte: doc#trecho” aumenta confiança e reduz invenção.
Threshold de confiança: se a similaridade for baixa, responder “não encontrei” em vez de chutar.
Impacto alto

Métricas: logar quais perguntas falham e ajustar index/prompt com base nisso.
Conversa: usar histórico de forma controlada (resumo do histórico, não tudo).
Se quiser, eu posso implementar um desses caminhos agora. Diga qual prioridade:

Embeddings reais + busca por similaridade
Melhor chunking + overlap + reindex
Prompt melhor + respostas com fonte + limiar de confiança
