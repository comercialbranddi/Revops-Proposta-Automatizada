# Handoff — Proposta Automatizada / frente de idiomas

Documento pra continuar a **tradução dos modelos (inglês e espanhol)** em outra
conversa. O português está pronto e em produção; nada aqui pede pra mexer nele.

---

## 1. O que é o projeto

Automação que gera a proposta comercial quando um card entra na fase **"Envio de
proposta"** (pipe `5. Vendas`, stage 257) no Pipedrive.

- **Repo:** `C:\Users\Usuário\Documents\evento\Proposta\automacoes-funil`
- **Deploy:** Vercel — `revops-proposta-automatizada.vercel.app`
- **Fluxo:** webhook do Pipedrive → copia o modelo do Google Docs → substitui
  placeholders → grava o link no card → posta nota.
- **Nada de IA em produção:** é sempre `copyTemplate` + `replaceAllText`.

### Estado atual
- 15 modelos em português: 4 de produto único + 11 combinações.
- Em piloto: só o card **60956** gera (`PROPOSAL_TEST_ONLY=true` na Vercel).
- Aguardando validação do time comercial nas amostras antes de liberar.

---

## 2. Os produtos

| Código | Produto | Vocabulário antigo |
|---|---|---|
| BB | Brand Bidding | BB |
| BBP | Buy Box Protection | **VC** (Violação Comercial) |
| GD | Golpes Digitais | **FR** (Fraude) |
| VM | Violação de Marca | VM |

Isso importa pra ler os arquivos antigos: `Proposta_Branddi_BB_FR` é BB + Golpes
Digitais; `Proposta_Branddi_VC` é Buy Box Protection.

---

## 3. O que existe em outro idioma

> **Esta seção foi superada.** Os nove documentos foram abertos e auditados em
> 11/08/2026 — ver **`AUDITORIA-IDIOMAS.md`**. A tabela abaixo foi montada pelos
> NOMES dos arquivos e três deles enganam. Use a auditoria; isto fica só como
> registro do que se acreditava antes.

Pasta do comercial (**somente leitura**, não escrever nela):
`https://drive.google.com/drive/folders/1yS1Vuqm_P9GESPfsjKdeh5jWLoQuGQel`

O resumo do que a auditoria corrigiu:

- São **nove** arquivos, não oito, descrevendo **seis** documentos distintos.
- `[ENGLISH] …_VM_FR.docx` contém **BB+VM+GD**, não GD+VM.
- `[ENGLISH] …_BB_VM_FR.docx` é o mesmo documento **preenchido pra Pierre Fabre**.
- Os dois `Propuesta_Branddi_BB` em espanhol são **idênticos**.
- **O bloqueio não é tradução**: o inglês vende contrato anual com fidelidade e o
  português vende sem fidelidade. É cláusula de contrato, não escolha de palavra.

### 📁 Propostas em Espanhol
| Arquivo | Equivale a | Modificado |
|---|---|---|
| Propuesta_Branddi_BB | BB | 19/02/2026 |
| Propuesta_Branddi_BB_FR.docx | BB+GD | 04/08/2026 |
| Propuesta_FordChile_Branddi_BB | BB (proposta de cliente real) | 12/02/2026 |

### 📁 Propostas em Inglês
| Arquivo | Equivale a | Modificado |
|---|---|---|
| [ENGLISH] Proposal_Branddi_BB | BB | 17/06/2025 |
| [ENGLISH] Proposal_Branddi_FR | GD | 12/05/2025 |
| [ENGLISH] Proposal_Branddi_BB_VM.docx | BB+VM | 05/03/2026 |
| [ENGLISH] Proposal_Branddi_VM_FR.docx | ~~GD+VM~~ → **BB+VM+GD** | 05/03/2026 |
| [ENGLISH] Proposal_Branddi_BB_VM_FR.docx | BB+GD+VM (**preenchido**) | 16/04/2026 |

### Cobertura real

Contando só o que é modelo aproveitável, e considerando base extraível de dentro
de combo (ver `AUDITORIA-IDIOMAS.md` §5):

| | PT | EN | ES |
|---|---|---|---|
| BB | ✅ | ✅ | ✅ |
| BBP | ✅ | ❌ | ❌ |
| GD | ✅ | ✅ | ⚙️ extraível de BB+GD |
| VM | ✅ | ⚙️ extraível de BB+VM | ❌ |
| **modelos alcançáveis** | **15 de 15** | 7 de 15 | 3 de 15 |

**BBP não aparece em documento EN ou ES nenhum** — busca por "Buy Box", "BBP" e
"caja de compra" nos nove: zero ocorrência. Tem que ser escrito do zero.

**Nenhum dos dois idiomas tem BBP nem VM sozinhos.** E as versões em inglês de
BB e GD são de 2025, anteriores à revisão dos modelos em português — provável
que estejam desatualizadas em relação ao que se vende hoje.

---

## 4. Como o português foi feito (o caminho a repetir)

1. **Importar** o modelo da pasta do comercial pro Drive Compartilhado
   (`files.copy` convertendo `.docx` → Google Doc preserva a formatação).
2. **Inserir placeholders** — `scripts/aplica-placeholders.js`.
3. **Montar as combinações** a partir dos bases — `scripts/monta-combos.js`.
   Cada combo nasce como cópia do base do primeiro produto (traz cabeçalho com
   logo, rodapé e estilos) e só o corpo é reescrito.
4. **Cadastrar** os `docId` em `PROPOSAL_TEMPLATES` (`src/config/proposal.js`).
5. **Testar** — `scripts/testa-modelos.js` e `scripts/testa-fluxo.js`.

### Placeholders que o generator substitui

| Placeholder | Vem de |
|---|---|
| `{{MARCA}}` | Organização do negócio (também usado no "Para:") |
| `{{PRECO_BB}}` `{{PRECO_BBP}}` `{{PRECO_GD}}` `{{PRECO_VM}}` | campos de preço |
| `{{PALAVRAS_BB}}` | Palavras-chave BB (qtd) |
| `{{CATALOGO_BBP}}` | Catálogo BBP (SKUs) |
| `{{PLATAFORMAS_VM}}` | Plataformas VM (qtd) |
| `{{CANAIS_BB}}` `{{CANAIS_BBP}}` `{{CANAIS_GD}}` `{{CANAIS_VM}}` | campos de canal |
| `{{CANAIS_COMBO}}` | união dos canais, só em combinação |
| `{{TOTAL_DE}}` `{{TOTAL_POR}}` | soma dos preços e Valor fechado do pacote |
| `XX de [mês] de [ano]` | data da geração, fuso `America/Sao_Paulo` |

Nos modelos traduzidos os placeholders são **os mesmos** — o que muda é o texto
ao redor. Ex.: no inglês, `Platform(s) Monitored: {{CANAIS_BB}}`.

---

## 5. O encanamento — RESOLVIDO em 11/08/2026

Os itens (a), (b) e (c) deixaram de ser decisão em aberto: estão implementados.
O código lê o idioma e escolhe o conjunto de modelos. **Nenhum modelo foi
traduzido** — o português segue idêntico e en/es estão vazios.

**a) O campo de idioma passou a ser lido.** `idiomaDoDeal(deal)` em
`src/config/proposal.js`. Campo vazio cai em português: ele é novo e a
esmagadora maioria dos cards está sem preencher — exigir preenchimento pararia
a geração de todo mundo.

**b) `PROPOSAL_TEMPLATES` é aninhado por idioma.**
`{ pt: { 'BB+GD': {...} }, en: {}, es: {} }`, com `resolveTemplate(idioma,
chave)` e `templatesDoIdioma(idioma)`. Escolhido sobre a chave composta
`'en:BB+GD'` porque o `monta-combos.js` filtra combo por `.includes('+')` e
passaria a tratar `'en:BB'` como combinação.

**c) Idioma sem modelo NÃO gera, e agora avisa.** O caminho de "sem template"
era mudo — o card não gerava e não dizia nada, indistinguível de automação
quebrada. Agora posta nota nomeando o motivo certo: "não existe modelo de BB+VM
em inglês" (existe em PT) ou "não existe modelo pra combinação BB+VM" (não
existe em idioma nenhum).

**Data localizada, moeda não.** `formatDate(date, idioma)` escreve a data no
idioma da proposta, e o generator manda **duas** chaves: a frase literal
`XX de [mês] de [ano]` (o que os 15 modelos PT trazem) e `{{DATA}}`, a
convenção pros modelos novos. Sem isso, o primeiro modelo EN cadastrado sairia
com a data não substituída, em silêncio.
**A moeda continua em BRL em qualquer idioma**, de propósito: em que moeda sai
uma proposta EN/ES, e de onde vem esse dado, é decisão comercial que ninguém
tomou. O ponto está marcado em `formatBRL`.

**Scripts ganharam `--idioma`.** Sete deles (`aplica-placeholders`,
`monta-combos`, `uniformiza-bases`, `audit-templates`, `testa-modelos`,
`export-templates`, `gera-amostras`). Sem a flag, comportam-se como antes.
Idioma inválido mata o processo — `--idioma=eng` num script com `--apply`
escreveria nos modelos de produção. Os três `fix-*` não têm a flag (migração de
uma vez só, casam texto em português) e o `limpa-drive` deliberadamente enxerga
**todos** os idiomas, senão a faxina apagaria modelo em uso.

O `monta-combos.js` agora deriva a lista de combos dos **bases disponíveis** em
vez das chaves já cadastradas — num idioma novo só os bases estão na config, e
filtrar por chave existente não montaria nada. Em português dá exatamente os
mesmos 11 (verificado).

### O que ainda falta

**d) Quem escreve o que falta.** Pra cobrir os 15 em cada idioma são
necessários os 4 bases traduzidos.

| | bases que existem | bases que faltam | alcançável hoje |
|---|---|---|---|
| EN | BB, GD, (VM extraível dos combos) | **BBP** | 7 de 15 |
| ES | BB, (GD extraível de BB+GD) | **BBP, VM** | 3 de 15 |

Base pode ser **extraída de dentro de um combo** — é a operação inversa do
`monta-combos.js`, que já sabe recortar bloco por produto. O `[ENGLISH] BB_VM`
e o `VM_FR` carregam o bloco de VM em inglês; o `Propuesta_BB_FR` carrega o de
GD em espanhol.

**BBP não aparece em nenhum documento EN nem ES** — esse tem que ser escrito do
zero nos dois idiomas.

**A auditoria foi feita em 11/08/2026 — ver `AUDITORIA-IDIOMAS.md`.** Ela achou
um bloqueio anterior a qualquer tradução: os documentos em inglês vendem
contrato anual com fidelidade, e o português vende sem fidelidade; os dois em
espanhol cobram setup de uma mensalidade, que o português não cobra. São
cláusulas de contrato, não escolhas de tradução.

A moeda também não está resolvida nem dentro do espanhol: o modelo de BB vende
em USD e o de BB+GD em BRL. Isso confirma manter `formatBRL` em reais.

Ordem correta: o comercial decide as condições, e só então se importa e
placeholderiza.

---

## 6. Referências

### Pastas no Drive
| | |
|---|---|
| Saída (Drive Compartilhado) | `0AFceGRk20ACBUk9PVA` |
| `_modelos` | os 15 em uso |
| `_amostras para validação` | exemplares preenchidos pra leitura humana |
| `_testes-piloto` | arquivo morto |
| Modelos do comercial (só leitura) | `1yS1Vuqm_P9GESPfsjKdeh5jWLoQuGQel` |

### Scripts
| Script | Para quê |
|---|---|
| `_idioma.js` | leitura e validação da flag `--idioma` (não é executável) |
| `aplica-placeholders.js` | insere os placeholders num modelo importado ⟨idioma⟩ |
| `monta-combos.js` | monta as combinações a partir dos bases disponíveis ⟨idioma⟩ |
| `uniformiza-bases.js` | padroniza fonte e paginação dos bases ⟨idioma⟩ |
| `testa-modelos.js` | bateria estrutural nos 15 (não toca no Pipedrive) ⟨idioma⟩ |
| `export-templates.js` | exporta os modelos em txt/docx/pdf ⟨idioma⟩ |
| `gera-amostras.js` | exemplares preenchidos pra validação humana ⟨idioma⟩ |
| `audit-templates.js` | auditoria de caixas, negrito e headings ⟨idioma⟩ |
| `testa-fluxo.js` | 16 cenários ponta a ponta pelo card de teste |
| `limpa-drive.js` | faxina das versões antigas e temporários |
| `fix-*.js` | correções pontuais já aplicadas nos modelos PT |

Todos aceitam simulação por padrão e `--apply` pra valer. ⟨idioma⟩ marca os que
aceitam `--idioma=en` / `--idioma=es`; sem a flag, operam em português.

Duas exceções deliberadas: o `limpa-drive.js` NÃO aceita `--idioma` porque
decide o que apagar e precisa enxergar os modelos de todos os idiomas; e as
checagens de conteúdo do `testa-modelos.js` continuam em português, então
`--idioma=en` só valida a metade estrutural.

### Acesso
- Service account: `proposal-bot@automacoes-pipedrive.iam.gserviceaccount.com`
- Credenciais em `.env` local (gitignored) — **e pendentes de rotação**, ver §7.

---

## 7. Pendências que atravessam qualquer frente

1. **Validação do comercial** nas 15 amostras em português. Enquanto não
   acontecer, traduzir corre o risco de traduzir texto que vai mudar. O
   encanamento (§5) foi feito sem essa dependência de propósito: ele não toca
   no conteúdo de modelo nenhum.
2. **Trava do piloto** (`PROPOSAL_TEST_ONLY`) — decisão do time, segurar por ora.

3. **O Pipedrive limita 100 notas por negócio, e a automação fica muda ao
   bater nesse teto.** Descoberto em 11/08/2026: o card de teste 60956 chegou
   às 100 notas e a API passou a recusar toda nota nova com HTTP 403 — que o
   `postNote` engole como warning, invisível pra quem olha o card.

   Em produção isso importa mais do que parece. O time optou por rodar sem
   Supabase, e o comentário do próprio `proposal-generator.js` diz que "o card
   é o ÚNICO registro do que aconteceu". Num negócio que acumule 100 notas, a
   automação para de conseguir avisar: falha técnica, "falta preencher preço" e
   "pulei porque não há modelo nesse idioma" viram todos indistinguíveis de
   "não fez nada".

   Não foi tratado — decisão de 11/08/2026 de só registrar. Quando a automação
   sair do piloto e passar a rodar em todos os cards, isto vira concreto. O
   ponto de conserto é o `postNote`: detectar o 403 de limite e degradar de
   forma visível (gravar num campo do card, ou logar como erro pra aparecer no
   monitoramento da Vercel).
4. **Rotacionar credenciais**: o token do Pipedrive e a chave da service account
   ficaram expostos no histórico da conversa em que o projeto foi construído.
   Google Cloud → IAM → Service Accounts → proposal-bot → Keys; e Pipedrive →
   Personal preferences → API.

---

## 8. Uma coisa que vale saber

Uma decisão recente mostrou que **nem todo item de "Serviço oferecido" é
produto**. Bing e APP eram tratados como serviços sem modelo e bloqueavam a
geração; na verdade são **canais de monitoramento** e viraram campo
(`Canais BB`, `Canais GD`). A evidência veio dos documentos: a linha
"Plataforma(s) Monitorada(s)" tem 18 valores distintos nas propostas reais.

Se algo parecido aparecer na tradução — um termo que parece produto mas é
canal, idioma ou região — vale checar nos documentos antes de criar modelo novo.
