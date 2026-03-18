# Roadmap de Evolução (RAG) — Checklist

## Princípios

- [ ] Priorizar qualidade da resposta e rastreabilidade (fontes)
- [ ] Manter arquitetura simples com ganhos incrementais
- [ ] Evitar dependências pesadas sem ganho claro

## Fase 0 — Preparação (1–2 dias)

- [ ] Atualizar `FLUXO.MD` para refletir o código atual (parâmetros, funções e nomes reais)
- [ ] Corrigir `.env.example` (duplicações e comentários colados)
- [ ] Padronizar encoding UTF-8 nos arquivos de texto com mojibake
- [ ] Revisar `README.md` para alinhamento com o fluxo atual
- [ ] Adicionar validação mínima de configuração na inicialização (ex.: variáveis obrigatórias)

## Fase 1 — Observabilidade e Qualidade (Semana 1)

- [ ] Log estruturado por requisição com `requestId`
- [ ] Métricas básicas: latência por etapa, taxa de cache hit, taxa de fallback
- [ ] Retornar as fontes no response do `/chat`
- [ ] Criar conjunto mínimo de avaliação (20–50 perguntas)
- [ ] Criar script simples de avaliação manual (CSV ou JSON com perguntas/answers)

## Fase 2 — Retrieval Moderno (Semana 2)

- [ ] Implementar busca híbrida (BM25 + vetor) como fallback preferencial
- [ ] Adicionar re-ranking leve (cross-encoder ou LLM pequeno) no topK
- [ ] Adicionar limiar de confiança para responder “não encontrei”
- [ ] Exibir “Fontes usadas” na resposta final

## Fase 3 — Ingestão e Contexto (Semana 3)

- [ ] Migrar chunking por palavras para chunking por tokens ou semântico
- [ ] Deduplicar conteúdo e melhorar limpeza de OCR
- [ ] Implementar “context budget” dinâmico (topK e tamanho por pergunta)
- [ ] Ajustar prompts para formato de resposta consistente

## Fase 4 — Produção e Escala (Semana 4)

- [ ] Persistência de histórico e cache em Redis
- [ ] Rate limiting e autenticação no `/chat`
- [ ] Healthcheck completo (LLM + embeddings + banco)
- [ ] Documentar runbooks de operação e troubleshooting

## Entregáveis por fase

- [ ] Fase 0: documentação e configuração confiáveis
- [ ] Fase 1: visibilidade do desempenho e qualidade
- [ ] Fase 2: ganho claro de precisão e confiança
- [ ] Fase 3: respostas mais consistentes e contextuais
- [ ] Fase 4: prontidão para ambiente multi-instância

## Próximos passos

- [ ] Confirmar foco principal: qualidade de resposta vs robustez de produção
- [ ] Escolher mecanismo de re-ranking (LLM local vs cross-encoder)
- [ ] Definir conjunto inicial de perguntas de avaliação
