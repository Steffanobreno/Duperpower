# Fino: backup e restauração

## Onde estão as cópias
1. **Neon (banco de produção):** a Neon guarda o histórico do banco e permite voltar a um momento do passado (*point-in-time restore*). Quanto tempo para trás depende do plano. Confira em **Neon → seu projeto → Settings → Storage / History retention**.
2. **Por empresa (opcional):** cada groomer pode ligar o backup semanal no Google Drive (Ajustes → Backups), que baixa `/api/device/backup`.
3. **Manual (recomendado uma vez por mês e antes de mudanças grandes):** `pg_dump`, explicado abaixo.

## Cópia semanal automática (GitHub Actions)
- Todo domingo o GitHub copia o banco inteiro, **restaura a cópia num banco vazio** e confere as contagens (empresas, clientes, visitas). Só então criptografa e guarda por 90 dias.
- Onde: GitHub → Duperpower → **Actions → backup** → abra uma execução verde → **Artifacts** → `fino-backup-AAAA-MM-DD`. O `counts.txt` dentro diz o que foi copiado.
- Precisa de dois segredos no repositório (passo a passo em docs/pendencias.md): `BACKUP_DATABASE_URL` (conexão **direta** da Neon, sem `-pooler`) e `BACKUP_PASSPHRASE` (senha longa; sem ela a cópia não abre, guarde no gerenciador de senhas).
- Para restaurar uma cópia dessas:
  ```
  gpg -d -o fino.dump fino-AAAA-MM-DD.dump.gpg        # pede a BACKUP_PASSPHRASE
  pg_restore --no-owner --no-acl -d "<DATABASE_URL de um branch novo da Neon>" fino.dump
  ```
  Restaure sempre num **branch novo** da Neon, confira, e só depois troque o `DATABASE_URL` no Netlify.

## Ensaio feito em 2026-11-07 (banco de teste local)
- `pg_dump -Fc` → arquivo de 171 KB → `pg_restore` num banco novo.
- Contagens iguais nas duas cópias: empresas 3, clientes 1, visitas 1, pagamentos 1, usuários 3, migrações 43.
- `npm run db:migrate` na cópia restaurada não teve nada a aplicar, então a cópia volta a funcionar com o app como está.
- **Ainda falta:** o mesmo ensaio na Neon, que precisa do seu acesso (passo a passo abaixo).

## Como restaurar na Neon (sem tocar no banco que está no ar)
1. Neon → **Branches → Create branch** → "Point in time" → escolha a data e a hora de antes do problema.
2. Copie a *connection string* do branch novo.
3. Confira os dados nele, por exemplo `psql "<string do branch>" -c "select count(*) from clients"`.
4. Se estiver certo, você tem duas opções:
   - trocar `DATABASE_URL` no Netlify pela string do branch e fazer um novo deploy; ou
   - na Neon, tornar esse branch o principal (*Set as primary*).
5. Nunca apague o branch antigo antes de confirmar que o novo está bom.

## Cópia manual (de qualquer computador com o PostgreSQL instalado)
```
pg_dump "<DATABASE_URL da Neon>" -Fc -f fino-AAAA-MM-DD.dump
```
Guarde o arquivo num lugar seguro: ele tem os dados de todos os clientes.

Para restaurar num banco vazio:
```
pg_restore -d "<banco vazio>" --no-owner fino-AAAA-MM-DD.dump
```
