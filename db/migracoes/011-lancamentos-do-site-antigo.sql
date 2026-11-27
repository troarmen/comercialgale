-- =============================================================================
-- 011 — Marcação "Lançamento" vinda do site antigo
--
-- POR QUÊ: o extrator do sistema antigo (scripts/extrair_legado.py) trouxe
-- `lancamento = false` em todos os produtos — o campo não vinha na
-- extração. O cliente pediu de volta (relatório de 24/11, item 1.2).
--
-- DE ONDE VEM A LISTA: os 185 produtos (pelo `legado_id`) que o site antigo
-- marca como lançamento, lidos em 27/11/2026 da listagem pública de
-- lançamentos (`POST /controller/produto/loadlist` com `isl=1`, paginada de
-- 20 em 20). O site antigo ainda responde pelo IP 191.6.218.131 com o header
-- `Host: www.comercialgale.com.br`, e o estado dele é o da virada (12/11).
-- Em relação à foto de 23/08: +16 (legado 2715–2731, cadastrados depois) e
-- −11 que a equipe já tinha desmarcado lá (2486–2491, 2499, 2541, 2589, 2603,
-- 2612). legado_id que não existir no banco é ignorado pelo join.
--
-- O QUE FAZ: só LIGA a marcação nesses produtos. Nunca desliga nada — os
-- lançamentos marcados à mão no painel depois da virada continuam como estão.
-- Depois de rodar, a equipe confere em Produtos → "Lançamentos" (mais novos
-- no topo) e desmarca o que não é mais novidade (caixa da linha ou em lote).
--
-- `updated_at` é preservado (gatilho desligado só durante o UPDATE, como na
-- 010): o sitemap usa `updated_at` e não deve anunciar 185 páginas mudadas.
--
-- BACKUP: os ids alterados vão para `_backup_011_lancamento` (sem acesso pela
-- API). PODE RODAR DE NOVO: só mexe no que ainda está desmarcado.
--
-- REVERTER (desmarca só o que esta migração marcou):
--
--   begin;
--   alter table public.produtos disable trigger t_produtos;
--   update public.produtos p
--      set lancamento = false
--     from public._backup_011_lancamento b
--    where b.produto_id = p.id;
--   alter table public.produtos enable trigger t_produtos;
--   drop table public._backup_011_lancamento;
--   commit;
--
-- Conferido depois de rodar: `select count(*) from produtos where lancamento;`
-- deve dar os que já estavam marcados + os ativados aqui (o NOTICE no fim
-- diz quantos). Rode inteiro, como postgres, no SQL Editor. Está em transação.
-- =============================================================================

begin;

create table if not exists public._backup_011_lancamento (
  produto_id  bigint primary key,
  guardado_em timestamptz not null default now()
);
alter table public._backup_011_lancamento enable row level security;
revoke all on public._backup_011_lancamento from public, anon, authenticated;

create temp table _011_lancamentos (legado_id bigint primary key) on commit drop;

insert into _011_lancamentos (legado_id) values
  (2467), (2468), (2469), (2470), (2471), (2472), (2475), (2477), (2480), (2482), (2484), (2485),
  (2502), (2503), (2504), (2506), (2508), (2510), (2511), (2512), (2514), (2515), (2519), (2520),
  (2522), (2526), (2527), (2529), (2530), (2533), (2534), (2535), (2537), (2538), (2540), (2542),
  (2544), (2545), (2546), (2547), (2550), (2551), (2552), (2553), (2554), (2555), (2556), (2557),
  (2558), (2559), (2560), (2561), (2562), (2564), (2569), (2570), (2572), (2573), (2574), (2577),
  (2578), (2579), (2580), (2581), (2582), (2583), (2584), (2585), (2587), (2588), (2590), (2592),
  (2595), (2596), (2597), (2598), (2599), (2600), (2601), (2605), (2606), (2607), (2608), (2609),
  (2613), (2614), (2615), (2618), (2619), (2620), (2622), (2623), (2624), (2625), (2626), (2627),
  (2628), (2629), (2630), (2631), (2642), (2643), (2644), (2645), (2646), (2647), (2648), (2649),
  (2650), (2651), (2652), (2653), (2654), (2655), (2656), (2657), (2658), (2659), (2661), (2663),
  (2664), (2665), (2666), (2667), (2668), (2669), (2670), (2671), (2672), (2673), (2674), (2675),
  (2676), (2677), (2678), (2679), (2680), (2681), (2683), (2684), (2685), (2686), (2687), (2688),
  (2689), (2690), (2691), (2692), (2693), (2694), (2695), (2696), (2697), (2698), (2699), (2700),
  (2701), (2702), (2703), (2704), (2705), (2706), (2708), (2709), (2710), (2711), (2712), (2713),
  (2714), (2715), (2717), (2718), (2719), (2720), (2721), (2722), (2723), (2724), (2725), (2726),
  (2727), (2728), (2729), (2730), (2731);

insert into public._backup_011_lancamento (produto_id)
select p.id
  from public.produtos p
  join _011_lancamentos l on l.legado_id = p.legado_id
 where not p.lancamento
on conflict (produto_id) do nothing;

alter table public.produtos disable trigger t_produtos;

do $$
declare
  n integer;
begin
  update public.produtos p
     set lancamento = true
    from _011_lancamentos l
   where l.legado_id = p.legado_id
     and not p.lancamento;
  get diagnostics n = row_count;
  raise notice '011: % produtos marcados como lançamento', n;
end $$;

alter table public.produtos enable trigger t_produtos;

commit;
