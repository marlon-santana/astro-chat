# FAQ — Importação de Turmas e Alunos via Planilha

## Visão Geral

### O que é a importação via planilha?

É um recurso que permite **criar ou atualizar turmas e importar alunos em massa** através de uma planilha padronizada.

A planilha deve conter duas abas:

- **Turmas** → cria ou atualiza turmas
- **Alunos** → importa e vincula alunos às turmas

⚠️ Regras importantes:

- A aba **Turmas não pode estar vazia**
- A aba **Alunos pode ficar vazia** se a importação for apenas de turmas

---

# Turmas

## O que acontece quando uma turma é importada?

O sistema verifica se já existe uma turma com o mesmo **nome_turma**.

### Se a turma não existir

- A turma é criada
- As disciplinas são criadas automaticamente com base na **matriz curricular**

### Se a turma já existir

O sistema **não cria uma nova turma**. Apenas atualiza:

- **polo** (se informado e diferente)
- **turno** (se informado e diferente)

Também ajusta o **módulo das disciplinas** se necessário.

⚠️ Outros campos **não são atualizados automaticamente**.

---

## O que é `nome_turma`?

É o **identificador da turma no sistema**.

Exemplo:

CTG261AMTEST

Regras:

- Deve ser **único por empresa**
- Se já existir, a turma será **atualizada**

---

## O que informar no campo `unidade`?

É a **unidade responsável pela turma**.

⚠️ Deve ser **idêntico ao cadastro do sistema**, incluindo acentos.

Exemplo:

(SP) Diadema
(SP) Jabaquara
(MG) Belo Horizonte - Centro
(PR) Curitiba

Se estiver diferente, a importação pode falhar.

---

## O campo `polo` é obrigatório?

Não.

Mas quando preenchido:

- deve existir no sistema
- deve corresponder exatamente ao nome cadastrado

---

## O que é o campo `curso`?

É o **curso ao qual a turma pertence**.

Regras:

- deve existir no sistema
- deve estar vinculado à **matriz curricular**

Caso contrário, a turma **não será criada**.

---

## Quais valores são aceitos no campo `turno`?

### São Paulo (SP)

- Semanal - Manhã
- Semanal - Tarde
- Semanal - Noite
- Sábado
- Integral

### Minas Gerais e Mato Grosso do Sul (MG / MS)

- Manhã
- Tarde
- Noite
- Sábado
- Integral Manhã
- Integral Tarde
- Integral Noite

⚠️ O valor deve ser exatamente igual ao listado.

---

## O que é `codigo_matriz`?

É o **código da matriz curricular da turma**.

Regras:

- Campo **obrigatório**
- A matriz deve existir no sistema
- Deve corresponder ao curso

Consultar matrizes em:

Menu → Gestão → Matrizes Curriculares

Se a matriz não existir, a turma **não será criada**.

---

## O campo `nota_minima` é obrigatório?

Não.

Se não for informado, o sistema usa o valor padrão:

5

---

## O que é `tempo_aula`?

Define a duração da aula em minutos.

Exemplo:

50 → aula de 50 minutos

---

## Quais valores são aceitos em `nivel`?

### São Paulo (SP)

- Capacitação
- Curso Técnico
- Especialização Técnica
- Qualificação

### Minas Gerais e Mato Grosso do Sul

- Capacitação
- Curso Livre
- Curso Técnico
- Especialização Técnica
- Qualificação

---

## Qual formato de data deve ser usado?

Os campos **inicio** e **fim** devem usar:

DD/MM/AAAA

Exemplo:
01/03/2025

---

## Para que serve `observacao_turma`?

Campo livre para **observações internas da turma**.

---

# Alunos

## Para que serve a aba Alunos?

Permite:

- importar alunos
- vincular alunos às turmas

Cada linha representa **um aluno**.

---

## Como o aluno é vinculado à turma?

Através do campo:

nome_turma

Esse valor deve ser **igual ao da aba Turmas** ou a uma turma existente.

---

## O que acontece se a turma não existir?

- O aluno **não será vinculado**
- Um **erro será registrado na importação**

---

## Como o sistema identifica um aluno?

O sistema procura na seguinte ordem:

1. **CPF**
2. **Nome**
3. **Empresa**

Se encontrar um aluno existente, ele será reutilizado.

---

## O CPF é obrigatório?

Não, mas é **fortemente recomendado**.

Ele melhora a identificação do aluno.

---

## O sistema cria automaticamente o curso do aluno?

Sim.

Antes do vínculo com a turma, o sistema verifica se o aluno já possui curso com:

- unidade
- turno
- nível
- grupo
- curso

Se não existir, o sistema **cria automaticamente**.

---

## Quais campos precisam ser compatíveis com a turma?

Os seguintes campos devem corresponder à turma:

- curso
- turno
- unidade
- polo (quando informado)
- nível
- grupo

Se houver divergência, a importação pode falhar.

---

## Qual formato usar em `nascimento`?

DD/MM/AAAA

Exemplo:

15/08/2002

---

## Quais dados adicionais podem ser informados?

Campos opcionais:

- genero
- cor_raca
- telefone
- celular
- lote

---

# Erros Comuns na Importação

Os erros mais frequentes são:

- unidade escrita diferente do cadastro
- turno inválido
- matriz curricular inexistente
- nome_turma diferente entre abas
- turma inexistente na aba alunos
- formato de data incorreto

---

# Boas Práticas

✔ Copiar exatamente os nomes cadastrados no sistema  
✔ Verificar se a matriz curricular existe  
✔ Garantir que o **nome_turma seja idêntico nas duas abas**  
✔ Usar sempre o formato **DD/MM/AAAA**  
✔ Preencher CPF sempre que possível
