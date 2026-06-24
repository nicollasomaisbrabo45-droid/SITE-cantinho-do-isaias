-- ==============================================================================
-- 🚀 SCRIPT DE CONFIGURAÇÃO DE RELATÓRIOS (SUPABASE)
-- Copie todo este código, cole no SQL Editor do Supabase e clique em RUN!
-- Este script cria uma função para agregar os dados financeiros das entregas.
-- O dia financeiro é calculado como reiniciando às 01:00 da manhã.
-- ==============================================================================

-- Garante que a coluna is_delivery exista na tabela orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_delivery BOOLEAN DEFAULT true;

CREATE OR REPLACE FUNCTION public.get_financial_reports()
RETURNS TABLE (
    report_date DATE,
    report_month TEXT,
    total_deliveries BIGINT,
    total_sales NUMERIC,
    total_delivery_sales NUMERIC,
    total_delivery_fees NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE((created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '1 hour') AS report_date,
        TO_CHAR(DATE((created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '1 hour'), 'YYYY-MM') AS report_month,
        COUNT(*) FILTER (WHERE is_delivery = true) AS total_deliveries,
        COALESCE(SUM(total), 0) AS total_sales,
        COALESCE(SUM(total) FILTER (WHERE is_delivery = true), 0) AS total_delivery_sales,
        COALESCE(SUM(delivery_fee), 0) AS total_delivery_fees
    FROM public.orders
    -- Filtra se necessário, mas aqui pegamos todo o histórico. 
    -- Se quiser apenas concluidos, pode adicionar: WHERE status = 'concluido'
    GROUP BY report_date, report_month
    ORDER BY report_date DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Dar permissão de execução para autenticados (ou todos, pois a página já bloqueia não admins)
GRANT EXECUTE ON FUNCTION public.get_financial_reports() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financial_reports() TO anon;
