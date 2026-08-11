# Auditoria dos modelos em inglês e espanhol

**11/08/2026.** Os nove documentos que o comercial mantém em outro idioma foram
lidos e comparados, bloco a bloco, com os quinze modelos em português em
produção. Complementa o `HANDOFF-IDIOMAS.md` §3, que listava os arquivos sem
tê-los aberto.

Versão navegável, com as tabelas formatadas:
`modelos-export/_auditoria-idiomas/relatorio.html` — **só existe na máquina de
quem rodou a auditoria**, porque `modelos-export/` é gitignored. O mesmo vale
pelos textos extraídos dos nove documentos, na mesma pasta. Este arquivo aqui é
a versão que viaja com o repo.

---

## Recomendação

**Não aplicar placeholders nos documentos em INGLÊS como estão.**

Todos os quatro vendem **contrato anual com fidelidade**, e ainda divergem entre
si no aviso prévio (90 dias num, 30 nos outros três). O português vende
**contrato sem fidelidade, com aviso de 60 dias**. Isso não é escolha de
tradução — é cláusula de contrato.

O espanhol está mais perto do que esta auditoria dizia na primeira versão: ele
cobra `Setup: 01 mensualidad`, **e o português cobra o mesmo** (`Setup: 01
mensalidade`, nos quatro bases). Aquela linha foi registrada como divergência
por engano, a partir de um export local desatualizado. A divergência real do
espanhol é só a **moeda** (§3).

> **Correção de 11/08/2026.** A primeira versão deste documento afirmava que "o
> português não cobra setup". Errado: os quatro modelos-base em português dizem
> `Setup: 01 mensalidade`. A afirmação veio de um `modelos-export/BB.txt` velho.
> Não dá pra saber se o export estava defasado ou se o modelo mudou no Drive,
> porque `modelos-export/` é gitignored.

**A decisão que segue aberta é uma só, e é comercial:** proposta para cliente de
fora tem contrato anual com fidelidade, como dizem os documentos em inglês, ou
sem fidelidade, como o português? Decidido em 11/08/2026 que segue o português —
ver §6.

---

## 1. O que existe de verdade

O handoff contava oito arquivos. São **nove**, e eles descrevem **seis
documentos distintos**: dois são cópias idênticas, dois são propostas já
preenchidas de clientes reais, e um tem nome que não corresponde ao conteúdo.

O conteúdo abaixo foi verificado pelas seções "Business proposal" /
"Propuesta Comercial" de cada documento, **não** pelo nome do arquivo.

| Arquivo | Alterado | Conteúdo real | Serve de modelo? |
|---|---|---|---|
| `[ENGLISH] …_BB` | 17/06/2025 | BB | sim |
| `[ENGLISH] …_FR` | 12/05/2025 | GD | sim |
| `[ENGLISH] …_BB_VM.docx` | 05/03/2026 | BB + VM | sim |
| `[ENGLISH] …_VM_FR.docx` | 05/03/2026 | **BB + VM + GD** — o nome omite o BB | sim |
| `[ENGLISH] …_BB_VM_FR.docx` | 16/04/2026 | BB + VM + GD, **preenchido pra Pierre Fabre** | não |
| `Propuesta_…_BB` (19/02) | 19/02/2026 | BB | sim |
| `Propuesta_…_BB` (12/02) | 12/02/2026 | **byte a byte idêntico ao de 19/02** | duplicata |
| `Propuesta_…_BB_FR.docx` | 04/08/2026 | BB + GD | sim |
| `Propuesta_FordChile_…_BB` | 12/02/2026 | BB, **preenchido pra Ford** | não |

As duas versões do `VM_FR` e do `BB_VM_FR` diferem em **14 linhas**, todas nome
de cliente e data. É o mesmo documento: um com `XXXX` no lugar da marca, outro
com "Pierre Fabre" escrito. O preenchido ainda carrega preços de cliente
(R$ 23.700 → R$ 14.900) e validade vencida ("Commercial terms valid until
July 14th").

## 2. O bloqueio: as condições comerciais não batem

Estas linhas saem no documento que o cliente assina.

| Documento | Setup | Duração do contrato | Validade |
|---|---|---|---|
| **Português** (produção) | 01 mensalidade | Sem fidelidade, aviso 60 dias | 15 dias |
| EN · BB | ⚠️ `$ 000,00` (nunca preenchido) | ⚠️ **Anual, aviso 90 dias** | ⚠️ ausente |
| EN · GD | ⚠️ `$ 000,00` | ⚠️ **Anual, aviso 30 dias** | ⚠️ ausente |
| EN · BB+VM | ⚠️ `$ 000,00` | ⚠️ **Anual, aviso 30 dias** | ⚠️ ausente |
| EN · BB+VM+GD | ⚠️ `$ 000,00` | ⚠️ **Anual, aviso 30 dias** | ⚠️ data fixa, vencida |
| ES · BB | 01 mensualidad *(igual ao PT)* | Sin permanencia, aviso 60 días | 15 días |
| ES · BB+GD | 01 cuota mensual *(igual ao PT)* | Sin permanencia, aviso 60 días | 15 días |

O inglês ainda diverge **de si mesmo**: 90 dias de aviso prévio no modelo de BB,
30 nos outros três.

**O espanhol não diverge nas condições** — setup, contrato e validade batem com
o português. O inglês está longe: os quatro documentos vendem fidelidade anual,
o oposto do que o modelo em português oferece.

## 3. A moeda: a decisão já foi tomada de dois jeitos

O `formatBRL` ficou travado em reais no código, anotado como "decisão comercial
pendente". Os documentos mostram que ela não só está pendente — foi resolvida de
formas contraditórias dentro do **mesmo idioma**.

| Documento | Moeda | Como aparece |
|---|---|---|
| ES · BB | **USD** | `4.900 USD/mes` |
| ES · BB (Ford Chile) | **USD** | `USD/mes` |
| ES · BB+GD | **BRL** | `R$ 9.900/mes` |
| EN · todos | BRL | `R$ 7.900/month` |
| EN · linha de setup | símbolo `$` | `Setup: $ 000,00` |

O espanhol vende em dólar quando é BB sozinho e em real quando é combo. Nenhum
documento em inglês usa dólar no preço, mas todos usam o cifrão no setup.

**Manter reais no código segue certo** enquanto isso não fechar: é o único
comportamento que não inventa uma regra que ninguém definiu.

## 4. Outros defeitos

Nenhum é bloqueante sozinho, mas todos seriam herdados pela automação.

**Ano escrito à mão na data.** O modelo de BB em inglês abre com
`Month XXX of 2024`; o de BB+VM, com `of 2025`. Não há marcador de ano — só o mês
é variável. Precisa virar `{{DATA}}` inteiro.

**Português vazando pros outros idiomas.** No espanhol, a linha de contrato tem
um trecho em português embutido e duplicado:

> Duración del contrato: Contrato sin permanencia mínima (fidelidad), con un
> aviso previo **para cancelamento sem multa** de 60 días para cancelación sin
> multa.

No inglês, a lista de plataformas diz
`Google + Meta (Facebook e Instagram) + TLD's (Dominios)` — "e" e "Dominios" são
português.

**Blocos rotulados com o produto errado.** Em `BB+VM`, o item 2 é a proteção de
Violação de Marca mas lista **Google + Meta** como plataformas, que são os canais
de Golpes Digitais. Em `BB+VM+GD`, o item 4 se intitula "Combo: Brand Bidding +
Intellectual Property Violation" e mostra as plataformas dos **três** produtos.

**Falta no inglês a linha de limite de palavras-chave** que em português vira
`{{PALAVRAS_BB}}`, e o monitoramento aparece só como "Google Search Ads", sem o
Google Shopping que o português já incorporou.

> **Correção de 11/08/2026.** Este parágrafo afirmava também que o inglês
> prometia um "Daily Report" que o português não vendia mais. Errado: o modelo
> em português **tem** esse entregável ("Relatório diário: as informações do
> monitoramento serão entregues diariamente no período da manhã…"). Veio da
> mesma leitura de export desatualizado que gerou o engano sobre o setup.

**Cada idioma usa um marcador diferente pra marca.** Inglês `XXXX`, espanhol
`XXX`, português já convertido pra `{{MARCA}}`. O `aplica-placeholders.js` só
conhece os marcadores em português — rodá-lo com `--idioma=en` hoje devolve zero
ocorrência em tudo (o que, aliás, é o jeito de listar quais marcadores
acrescentar).

## 5. Até onde daria pra chegar

Supondo os problemas acima resolvidos, esta é a cobertura alcançável **sem
redigir texto novo**. Um base pode ser extraído de dentro de um combo — é a
operação inversa do `monta-combos.js`, que já sabe recortar bloco por produto.

| Idioma | Bases prontos | Bases extraíveis | Faltando | Cobertura |
|---|---|---|---|---|
| Português | BB, BBP, GD, VM | — | — | **15 de 15** |
| Inglês | BB, GD | VM (de BB+VM) | **BBP** | 7 de 15 |
| Espanhol | BB | GD (de BB+GD) | **BBP, VM** | 3 de 15 |

**Buy Box Protection não aparece em nenhum dos nove documentos** — procurei por
"Buy Box", "BBP" e "caja de compra": zero ocorrência. Esse produto tem que ser
escrito do zero nos dois idiomas; não há o que traduzir nem de onde extrair.

## 6. O que fazer

Em ordem — e a primeira não é técnica.

1. **O comercial decide as condições em cada idioma.** Proposta em inglês tem
   fidelidade anual ou não? Em espanhol cobra setup de uma mensalidade? Sai em
   dólar ou em real? Sem isso respondido, qualquer tradução é chute com aparência
   de decisão.
2. **Descartar os dois documentos preenchidos** (Pierre Fabre e Ford Chile) como
   fonte de modelo. Servem de referência de proposta real, não de base.
3. **Apagar a duplicata em espanhol.** As duas cópias de
   `Propuesta_Branddi_BB` são idênticas, e manter as duas garante que uma hora
   alguém edite a errada.
4. **Renomear o `[ENGLISH] …_VM_FR.docx`**, que contém BB+VM+GD. O nome atual faz
   qualquer um — inclusive esta auditoria, na primeira leitura — contar a
   cobertura errado.
5. **Só então importar e placeholderizar.** Cadastrar os `docId` em
   `PROPOSAL_TEMPLATES.en` / `.es` e os modelos entram no fluxo. Até lá, card que
   pedir inglês ou espanhol não gera proposta e recebe nota explicando.

---

## Como isto foi apurado

Os nove arquivos foram baixados da pasta do comercial em **somente leitura** —
nada foi escrito, movido ou renomeado no Drive. Os `.docx` tiveram o texto
extraído localmente (`word/document.xml`); os Google Docs foram exportados como
texto puro.

Arquivos de trabalho em `modelos-export/_auditoria-idiomas/`, ao lado dos exports
em português usados na comparação. Pasta de origem (só leitura):
`1yS1Vuqm_P9GESPfsjKdeh5jWLoQuGQel`, subpastas "Propostas em Inglês"
(`1ZBL4Pv_x3WA9irL3JLB-hkS3Xm5S-nM0`) e "Propostas em Espanhol"
(`183nrj3WPLf4eFsj2lyQX3m0BAji7t5Q0`).
