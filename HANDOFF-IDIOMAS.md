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

Pasta do comercial (**somente leitura**, não escrever nela):
`https://drive.google.com/drive/folders/1yS1Vuqm_P9GESPfsjKdeh5jWLoQuGQel`

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
| [ENGLISH] Proposal_Branddi_VM_FR.docx | GD+VM | 05/03/2026 |
| [ENGLISH] Proposal_Branddi_BB_VM_FR.docx | BB+GD+VM | 16/04/2026 |

### Cobertura real

| | PT | EN | ES |
|---|---|---|---|
| BB | ✅ | ✅ | ✅ |
| BBP | ✅ | ❌ | ❌ |
| GD | ✅ | ✅ | ❌ |
| VM | ✅ | ❌ | ❌ |

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

## 5. O que falta decidir antes de codar

**a) O campo de idioma já existe e não faz nada.**
`Idioma da proposta` (Português / Inglês / Espanhol), chave
`9c95729a15906d4c92843a4fc2c6e79615f103b8`, grupo Closer. O closer preenche, mas
a automação ignora — sempre usa português.

**b) Como o `PROPOSAL_TEMPLATES` passa a ser indexado.**
Hoje é `{ 'BB+GD': { docId } }`. Com idioma vira algo como
`{ pt: { 'BB+GD': {...} }, en: {...} }`, ou chave composta `'en:BB+GD'`.
Decisão de arquitetura, não é grande, mas muda o `resolveProductCodes`.

**c) O que fazer quando não existe modelo no idioma pedido.**
Três opções: cair pro português, não gerar e avisar por nota, ou gerar só as
combinações cobertas. **Recomendo não gerar e avisar** — mandar proposta em
português pra cliente que pediu inglês é pior que não mandar.

**d) Quem escreve o que falta.**
Pra cobrir os 15 em cada idioma são necessários os 4 bases traduzidos. Faltam
BBP e VM em inglês, e BBP, GD e VM em espanhol. Os combinados o script monta
sozinho depois.

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
| `aplica-placeholders.js` | insere os placeholders num modelo importado |
| `monta-combos.js` | monta as 11 combinações a partir dos 4 bases |
| `uniformiza-bases.js` | padroniza fonte e paginação dos bases |
| `testa-modelos.js` | bateria estrutural nos 15 (não toca no Pipedrive) |
| `testa-fluxo.js` | 12 cenários ponta a ponta pelo card de teste |
| `gera-amostras.js` | exemplares preenchidos pra validação humana |
| `limpa-drive.js` | faxina das versões antigas e temporários |
| `audit-templates.js` | auditoria de caixas, negrito e headings |

Todos aceitam simulação por padrão e `--apply` pra valer.

### Acesso
- Service account: `proposal-bot@automacoes-pipedrive.iam.gserviceaccount.com`
- Credenciais em `.env` local (gitignored) — **e pendentes de rotação**, ver §7.

---

## 7. Pendências que atravessam qualquer frente

1. **Validação do comercial** nas 15 amostras em português. Enquanto não
   acontecer, não faz sentido traduzir — corre o risco de traduzir texto que vai
   mudar.
2. **Trava do piloto** (`PROPOSAL_TEST_ONLY`) — decisão do time, segurar por ora.
3. **Rotacionar credenciais**: o token do Pipedrive e a chave da service account
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
