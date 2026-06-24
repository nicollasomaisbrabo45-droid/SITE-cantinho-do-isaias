-- ==============================================================================
-- 🚀 SCRIPT DE CONFIGURAÇÃO DE RELATÓRIOS (SUPABASE)
-- Copie todo este código, cole no SQL Editor do Supabase e clique em RUN!
-- Este script cria uma função para agregar os dados financeiros das entregas.
-- O dia financeiro é calculado como reiniciando às 01:00 da manhã.
-- ==============================================================================

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
        -- Calcula a data subtraindo 1 hora após converter para o fuso de SP
        -- Ex: 2026-06-25 00:30 vira 2026-06-24 23:30 (dia 24)
        -- Ex: 2026-06-25 01:30 vira 2026-06-25 00:30 (dia 25)
        DATE((created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '1 hour') AS report_date,
        TO_CHAR(DATE((created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') - INTERVAL '1 hour'), 'YYYY-MM') AS report_month,
        
        -- Conta apenas os pedidos que são de entrega
        COUNT(*) FILTER (WHERE is_delivery = true) AS total_deliveries,
        
        -- Soma o total de todos os pedidos do dia
        COALESCE(SUM(total_amount), 0) AS total_sales,
        
        -- Soma o valor total (geralmente produtos + taxa) apenas dos pedidos de entrega
        COALESCE(SUM(total_amount) FILTER (WHERE is_delivery = true), 0) AS total_delivery_sales,
        
        -- Soma as taxas de entrega
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
