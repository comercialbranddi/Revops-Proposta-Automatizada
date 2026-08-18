-- 002: proposal_spec — o que foi preenchido no formulário, congelado.
--
-- A partir de 18/08/2026 a proposta não é mais montada a partir dos campos do
-- negócio: quem preenche é o formulário, e o resultado vive aqui. A tabela é
-- o INSERT-only de novo, e de propósito — proposta é documento datado, não
-- estado atual do card:
--
--   * campo de deal guarda só o último valor. Se o preço for renegociado em
--     setembro, não dá pra reconstruir o que o cliente recebeu em agosto;
--   * o /flow do Pipedrive não registra alteração de campo customizado, então
--     nem dá pra auditar quem mudou o quê;
--   * um negócio tem VÁRIAS propostas ao longo da vida (revisão, renegociação).
--
-- Cada envio do formulário é uma linha nova. `revisao` conta por negócio.
CREATE TABLE IF NOT EXISTS proposal_spec (
    id BIGSERIAL PRIMARY KEY,
    deal_id BIGINT NOT NULL,
    revisao INT NOT NULL DEFAULT 1,

    -- Quem preencheu. Vem do login Google Workspace, não de campo digitado —
    -- é a única autoria confiável que o fluxo tem.
    criado_por TEXT NOT NULL,

    -- O formulário inteiro, como enviado: produtos, modalidade por produto,
    -- marcas, canais, quantidades, faixas, preços, idioma. JSONB porque o
    -- conjunto de campos muda por produto e vai continuar mudando — coluna
    -- por variável viraria a mesma bagunça de 49 colunas do deal.
    spec JSONB NOT NULL,

    -- Preenchidos quando a geração conclui.
    doc_url TEXT,
    gerado_em TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proposal_spec_deal_id_idx ON proposal_spec (deal_id);
CREATE INDEX IF NOT EXISTS proposal_spec_criado_por_idx ON proposal_spec (criado_por);

-- A última revisão de cada negócio — é o que o formulário carrega ao reabrir.
CREATE OR REPLACE VIEW proposal_spec_atual AS
SELECT DISTINCT ON (deal_id) *
FROM proposal_spec
ORDER BY deal_id, revisao DESC, id DESC;
