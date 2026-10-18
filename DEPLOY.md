# Deploy da rodada backend (out/2026)

Checklist para pôr no ar: e-mails pelo Brevo, papel colaborador, telas de
senha. Faça **na ordem** — cada passo depende do anterior.

Já feito em produção em 18/10/2026 (não refazer): cadastro público do
Supabase Auth **desligado**; migrações **005 a 008** aplicadas.

---

## 1. Brevo — autenticar o domínio (antes de tudo: o DNS demora)

Usamos a conta Brevo que já existe (do outro cliente). Uma conta aceita
vários domínios.

1. Brevo → **Configurações → Remetentes, domínios e IPs → Domínios →
   Adicionar domínio** → `comercialgale.com.br`.
2. O Brevo mostra os registros DNS (código de verificação `brevo-code`,
   **DKIM** e **DMARC**). Publique **exatamente** o que ele mostrar, onde o DNS
   do domínio é administrado (Registro.br, Cloudflare ou a hospedagem).
3. **Cuidado com o SPF.** O domínio já recebe e-mail (`contato@`), então já
   deve existir um registro TXT começando com `v=spf1`. Se o Brevo pedir
   SPF, **acrescente o `include:` dele no registro existente** — domínio com
   DOIS registros `v=spf1` falha o SPF inteiro. Fica assim, por exemplo:
   `v=spf1 include:(o que já existe) include:spf.brevo.com ~all`
4. **DMARC**: se o domínio ainda não tem `_dmarc`, comece com `p=none`
   (só monitora). Endurecer para `quarantine` depois de semanas sem falha.
5. Volte ao Brevo e clique em **Autenticar**. Pode levar de minutos a algumas
   horas. Só siga quando o domínio aparecer como autenticado.
6. **Remetentes** → confirme que `contato@comercialgale.com.br` está lá e
   verificado.
7. **SMTP e API → SMTP** → anote o **servidor**, a **porta** e o **login**
   (algo como `xxxxxx@smtp-brevo.com`) e **gere uma chave SMTP** chamada
   `comercialgale-site`. A senha é essa chave, não a senha da conta.

> **Limite**: o plano grátis tem 300 e-mails/dia **por conta** — dividido com
> o outro cliente. A Galé usa algumas dezenas num dia muito bom; se o outro
> cliente crescer, é o Brevo que avisa.

## 2. Variáveis de ambiente na hospedagem (produção)

| Variável | Valor |
|---|---|
| `SMTP_HOST` | servidor do passo 1.7 (`smtp-relay.brevo.com`) |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | login do passo 1.7 |
| `SMTP_SENHA` | chave SMTP do passo 1.7 |
| `EMAIL_REMETENTE` | `Comercial Galé <contato@comercialgale.com.br>` |
| `NEXT_PUBLIC_SITE_URL` | `https://www.comercialgale.com.br` — monta os links dos e-mails; errado aqui = link quebrado |

As do Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`) já existem — não mudam.

## 3. Migração 009 no Supabase de produção

SQL Editor → New query → cole `db/migracoes/009-trava-link-senha.sql` → Run.
Conferência:

```sql
select proname from pg_proc where proname = 'link_senha_liberado';
```

(É compatível com o código antigo — pode rodar antes do deploy.)

## 4. Deploy do código

Branch `main` com os commits da rodada backend. Antes:
`npx tsc --noEmit` e `npx eslint src --max-warnings 0` (precisam de
`npx next typegen` antes do tsc numa máquina que nunca rodou o projeto).

## 5. Teste em produção (10 minutos)

1. **Senha**: em `/esqueci-senha`, peça o link para o **seu** e-mail de admin.
   Tem de chegar na **caixa de entrada**, não no spam. No Gmail, abra o
   e-mail → ⋮ → **Mostrar original**: `SPF: PASS`, `DKIM: PASS`,
   `DMARC: PASS`. Se algum falhar, volte ao passo 1.
2. Clique no link, crie a senha, confirme que caiu no painel.
3. **Colaborador**: painel → Equipe → crie um com um e-mail seu de teste,
   entre com ele, confira que só vê Pedidos. Depois **remova**.
4. **Cadastro**: só se quiser testar ponta a ponta — gera uma ficha
   `incompleto` em Clientes; apague depois.

## 6. Painel → Configurações → e-mails de notificação

Confirme quem recebe os avisos de **pedido novo** e de **cadastro para
aprovar** (hoje: `contato@comercialgale.com.br`). Pode ser mais de um.

## 7. Opcional — SMTP do Supabase Auth

Nenhum fluxo do site usa mais os e-mails do Supabase (o link de senha é
nosso). Mas o botão "Send password recovery" do dashboard do Supabase ainda
usa o SMTP padrão dele, que é limitado. Para cobrir esse caso: Supabase →
**Authentication → Emails → SMTP Settings** → mesmo servidor/login/chave do
Brevo, remetente `contato@comercialgale.com.br`.

---

## Se algo der errado

- **E-mail não chega**: o painel continua funcionando — ao criar login, ele
  mostra o link para copiar e mandar por WhatsApp. Veja os logs da
  hospedagem procurando `[email]`.
- **Voltar o código**: as migrações 005–009 são compatíveis com o código
  anterior; reverter o deploy não exige mexer no banco.
- **Não religue** o cadastro público do Supabase Auth: o site não usa
  `signUp`, e ele foi a porta da brecha corrigida na 005.
