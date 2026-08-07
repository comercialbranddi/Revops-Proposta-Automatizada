-- 001: proposal_generation_log — auditoria da automação de proposta (piloto)
--
-- Tabela INSERT-only, só pra dar visibilidade de quantas gerações deram
-- certo/erro/pularam por falta de template durante o piloto.
CREATE TABLE IF NOT EXISTS proposal_generation_log (
    id BIGSERIAL PRIMARY KEY,
    deal_id BIGINT NOT NULL,
    -- 'success' | 'error' | 'skipped_no_template' | 'skipped_missing_fields'
    -- | 'skipped_concurrent' (perdeu a trava pra outra execução do webhook)
    -- | 'skipped_already_generated' (card já tinha Link Proposta preenchido)
    status TEXT NOT NULL,
    template_used TEXT,
    doc_url TEXT,
    error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS proposal_generation_log_deal_id_idx ON proposal_generation_log (deal_id);
