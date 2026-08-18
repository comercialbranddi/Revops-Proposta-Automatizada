# Plano — Formulário de propostas

**18/08/2026.** Primeira parte da evolução do projeto: a proposta deixa de ser
disparada sozinha pelo card e passa a ser montada num formulário. O modelo novo
do documento está em validação à parte e **não bloqueia isto** — o formulário
coleta os mesmos dados independentemente de a saída ser Google Doc ou página.

---

## 1. O que muda

**Hoje.** O card entra em "Envio de proposta" (stage 257, pipe 1) → webhook →
`generateProposalForDeal` lê ~20 campos do deal → se falta algum, posta nota no
card → gera e escreve o link em "Link Proposta".

Três defeitos, todos do mesmo tipo: quem preenche não vê o que falta até a nota
chegar; os campos da proposta estão diluídos entre os 49 customizados do deal; e
não existe prévia — só dá pra conferir depois de gerado.

**Depois.** O closer abre o formulário a partir do card, preenche guiado pelos
produtos que marcou, vê a prévia ao lado, e gera. O webhook para de gerar
sozinho e passa só a avisar que o card chegou na fase.

---

## 2. Onde vive

- Mesma app (`automacoes-funil`, Vercel). Rota `/proposta/:dealId` para a tela e
  as rotas de API que já existem para o resto.
- **Auth: Google Workspace, domínio `branddi.com`.** `google-auth-library` já é
  dependência do projeto por causa do Docs. Sem senha compartilhada — com senha
  não dá pra saber quem gerou, e é exatamente isso que precisa ir pro log.
- Entrada pelo card: link direto `/{dealId}`. O campo "Link Proposta" continua
  recebendo a saída, não a entrada.

---

## 3. Campos

### 3.1 Sempre visíveis

| Campo | Origem hoje | Obrigatório | Nota |
|---|---|---|---|
| Organização | `org_name` do deal | sim | vira `{{MARCA}}` e nomeia a pasta no Drive |
| Serviços | `aecc449a…` (multi) | sim | BB 152 · BBP 549 · GD 153 · VM 154 · VC 361→BBP |
| Idioma | `9c95729a…` | não | pt 1588 · en 1589 · es 1590; vazio = pt |
| Valor do pacote | `798658c5…` | não | vazio = sem desconto, lista preço cheio |

### 3.2 Por produto — só aparecem se o produto estiver marcado

| Produto | Campo | Key | Obrigatório |
|---|---|---|---|
| BB | Preço | `f687fc23…` | sim |
| BB | Palavras-chave (qtd) | `0d5efa1d…` | sim, exceto se só App Store |
| BB | Canais | `9c5b5764…` | não (cai no padrão) |
| BB | Faixas 2 e 3 (qtd + preço) | `39b216ad…`/`012cab9f…`, `4222fd02…`/`5a879c75…` | não, mas nunca pela metade |
| BBP | Preço | `be55b1ef…` | sim |
| BBP | Catálogo (SKUs) | `730d76b0…` | sim |
| BBP | Canais | `5fa38fdf…` | não |
| BBP | Faixas 2, 3 e 4 | `776d4e04…` … `18f5ea6a…` | não, mas nunca pela metade |
| BBP | Sob Consulta | `b3785205…` (sim=1614) | não; só faz sentido com escada |
| GD | Preço | `1246a7be…` | sim |
| GD | Canais | `4b28d56b…` | não |
| VM | Preço | `6452627c…` | sim |
| VM | Plataformas (qtd) | `8d6b50fb…` | sim |
| VM | Canais | `2200631e…` | não |

### 3.3 Campos novos — não existem no Pipedrive

| Campo | Escopo | Por que trava o modelo atual |
|---|---|---|
| Marcas monitoradas | global | hoje `{{MARCA}}` é `org_name`, uma string; múltiplas marcas quebram isso na raiz |
| Modalidade (monitoria / atuação / ambos) | **por produto** | muda TEXTO, não número — ver §5 |

### 3.4 Casos especiais que o formulário precisa conhecer

- **App Store** (canal BB 1609): sozinho, muda o formato — título ganha sufixo e
  a linha de palavras-chave some. Junto de outro canal, não muda nada.
- **Serviços sem modelo**: APP 415, Bing 416, Novos Termos 697. Hoje bloqueiam a
  geração. O formulário deve dizer isso na tela, não numa nota depois.
- **Escada pela metade** é o erro mais provável: quantidade preenchida e preço
  não. Validação inline, campo a campo.

---

## 4. Fluxo de telas

1. **Abre pelo card** → carrega o deal, pré-preenche tudo que já existe.
2. **Escopo** → serviços, marcas, países, idioma, modalidade.
3. **Por produto** → canais e quantidades, um painel por produto marcado.
4. **Preços** → preço de cada produto, faixas (recolhidas por padrão), pacote.
5. **Revisão** → prévia do documento ao lado, lista do que falta.
6. **Gerar** → grava os valores de volta no deal, gera, escreve "Link Proposta",
   registra em `proposal_generation_log` com o e-mail de quem gerou.

O passo 6 é o que preserva o CRM: o Pipedrive continua sendo o registro, o
formulário é só a interface. Sem isso o time digita duas vezes e o reporting
morre.

---

## 5. Modalidade — decidido em 18/08/2026: **por produto**

Cada produto tem sua própria modalidade: **Monitoria**, **Atuação** ou
**Monitoria + Atuação**. Dá para vender BB com atuação e VM só monitoria no
mesmo contrato.

**Consequência imediata.** O bloco de BB afirma hoje que *"executamos o serviço
de assessoria jurídica que contempla a redação, envio e acompanhamento de
notificações extrajudiciais"*. Numa venda só de monitoria isso é falso dentro de
um documento comercial — e não se resolve com placeholder, o parágrafo precisa
ter versões diferentes.

Com modalidade por produto, a matriz de modelos pré-gerados vai de **45 para 135
documentos** (15 combinações × 3 modalidades × 3 idiomas). Isso encerra a
discussão sobre o Google Doc pré-mesclado: **a migração para blocos compostos em
tempo de geração deixa de ser opcional.**

Sequência que isso impõe:

1. Formulário coleta modalidade por produto (esta parte) — os campos existem e o
   dado passa a ser gravado, mesmo antes de mudar a renderização.
2. Enquanto a renderização por blocos não existe, o gerador **bloqueia** as
   combinações cuja modalidade não seja "Monitoria + Atuação", que é o que os 45
   modelos atuais descrevem. Melhor não gerar do que gerar prometendo atuação
   numa venda de monitoria.
3. Migração do conteúdo para blocos (parte 2) libera o resto.

### 5.1 Campos novos a criar

Território ficou de fora (18/08/2026): a cobertura da proposta é a dos idiomas
que já têm modelo — pt, en e es — e o campo "Idioma da proposta" já carrega
essa dimensão. Fica registrado o limite: um cliente brasileiro que queira
monitoramento na Argentina não tem como expressar isso hoje.

| Campo | Tipo | Opções |
|---|---|---|
| Marcas monitoradas | `text` | livre, uma por linha |
| Modalidade BB | `enum` | Monitoria · Atuação · Monitoria + Atuação |
| Modalidade BBP | `enum` | idem |
| Modalidade GD | `enum` | idem |
| Modalidade VM | `enum` | idem |

São 5 campos novos num deal que já tem 49 customizados. Vale a ressalva: o
problema conhecido do funil é dado escondido, não campo sem uso. O que justifica
somar aqui é que, com o formulário, ninguém mais procura esses campos no card —
eles existem para o gerador ler e para o reporting contar. Modalidade segue por
produto o mesmo padrão que preço, canais e quantidade já seguem.

---

## 6. Fora de escopo desta parte

- Modelo novo do documento (em validação).
- Página de proposta com link e telemetria (depende do modelo).
- LLM para sumário executivo (depois do modelo; nunca no caminho de preço,
  condição ou texto jurídico).
- Diagnóstico preliminar: vem de sistema, não do formulário.

---

## 7. Observabilidade, desde o primeiro commit

`proposal_generation_log` já existe. Acrescentar: e-mail de quem gerou, duração,
e — quando o LLM entrar — tokens e custo. Das quatro automações de final de
funil, nenhuma mede token hoje; não repetir isso aqui.

---

## 8. Onde o preenchido é gravado — planilha, não banco

Decidido em 18/08/2026, depois de descobrir que **não existe Supabase na
Branddi**: a dependência está no `package.json` de vários repos e engana, mas
as variáveis nunca foram configuradas e o `.env.example` registra a escolha de
07/08/2026 de rodar sem banco.

O que existe e está pago é o Google Workspace. A service account
`proposal-bot@automacoes-pipedrive` já tem escopo `drive`, que a API de Sheets
aceita — então o destino é uma **planilha append-only no Drive**
(`src/services/spec-store.js`), uma linha por envio:

`registrado_em · deal_id · revisao · criado_por · doc_url · gerado_em · spec_json`

Nunca se edita linha. As únicas células escritas depois são `doc_url` e
`gerado_em`, que só existem quando a proposta é gerada — o `spec` em si é
imutável.

**O que isso custa:** planilha não tem transação. Dois envios simultâneos no
mesmo negócio podem calcular a mesma revisão. Com 359 negócios chegando nessa
etapa na vida inteira do funil, é aceitável. Se deixar de ser, `spec-store.js`
troca de implementação sem mexer em quem chama.

Setup: criar a planilha num Drive Compartilhado, dar Editor à service account,
pôr o ID em `PROPOSAL_SPEC_SHEET_ID` e habilitar a Sheets API no projeto
`automacoes-pipedrive`. A aba e o cabeçalho nascem sozinhos.
