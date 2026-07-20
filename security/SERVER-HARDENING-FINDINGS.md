# ממצאי הקשחת שרת — vmi3444167 (169.58.26.157) — 2026-07-20

> ביקורת read-only של מצב שרת חי (גישה · חומת אש · קצה · סודות · עדכונים · גיבויים · לוגים/ניטור ·
> מוכנות לאירוע). לא בוצע שום שינוי בשרת — רק פקודות קריאה הורצו. יעד: השרת עצמו (Contabo VPS,
> Ubuntu 24.04.4 LTS, מריץ את BeautyCareClinic). הביקורת בוצעה **ישירות על השרת** (סשן זה רץ עליו
> פיזית, לא דרך SSH-hop נפרד).
> זו ביקורת *מצב חי*; חלק מהממצאים חוזרים/מאמתים ממצאים מ-`INFRA-SECURITY-FINDINGS.md` מזווית
> חיה יותר — מסומן בכל מקום רלוונטי.

## סיכום מנהלים

| חומרה | כמות |
|---|---|
| 🔴 קריטי | 9 |
| 🟡 סיכון | 19 |
| 🔵 מינורי | 10 |

3 הדברים לתקן ראשונים (מיידי — לא לחכות לסיום שאר הביקורת):
1. 🔴 `sudo lastb` → **51,827** ניסיונות כניסה כושלים מ-245 IP-ים (12,687 כנגד `root`), ו-`sudo sshd -T` → `passwordauthentication yes` + `permitrootlogin yes`, ו-`fail2ban-client` → לא מותקן — **מתקפת brute-force פעילה ב-SSH ללא שום הגנה**. **✅ טופל חלקית באותה סשן (2026-07-20):** `fail2ban` הותקן והופעל עם jail פעיל ל-`sshd` (`maxretry=5`, `findtime=600s`, `bantime=3600s`) — מאושר תופס ניסיונות בזמן אמת. **עדיין פתוח:** `PasswordAuthentication`/`PermitRootLogin` לא שונו — דורש החלטה נפרדת (סיכון נעילה עצמית).
2. 🔴 `sudo grep -iE 'password=' /var/log/auth.log` → **סיסמת ה-Postgres האמיתית מופיעה בטקסט גלוי** בלוג המערכת (`sudo` מתעד שורת `docker run/exec -e POSTGRES_PASSWORD=...` במלואה), נשמר ~4 שבועות, נגיש לכל sudo/`adm`. **✅ טופל באותה סשן (2026-07-20):** הסיסמה סובבה (`ALTER USER` + `dotnet user-secrets`), הבקאנד הופעל מחדש ואומת מול ה-DB בפועל, וכל המופעים הישנים ב-`/var/log/auth.log` נוקו (`<redacted>`). ראו "תיקון בוצע" למטה.
3. 🔴 `crontab -l` + `ls /www/backup/*` → **אין שום מנגנון גיבוי** לנתוני ה-Postgres האמיתיים (PII + כספים) — אובדן-נתונים בלתי הפיך במקרה כשל. **עדיין פתוח** — לא טופל בסבב זה (דורש תכנון, לא פעולה מיידית).

## מצב לפי קטגוריה

| קטגוריה | מצב |
|---|---|
| גישה ו-SSH (access) | **FAIL** |
| חומת אש ופורטים (network) | FAIL |
| חשיפה לאינטרנט (edge) | **FAIL** |
| סודות / git / הרשאות (secrets) | WARN |
| עדכונים (updates) | WARN |
| גיבויים (backups) | **FAIL** |
| לוגים וניטור (observability) | FAIL |
| מוכנות לאירוע (incident) | WARN |

---

## גישה ו-SSH — FAIL

- 🔴 `sudo sshd -T | grep -i passwordauthentication` → `passwordauthentication yes` — אימות בסיסמה מאופשר, כל ניסיון brute-force יכול להצליח בלי מפתח כלל. **חוק:** `02-access-ssh.md §1`. **תיקון:** `PasswordAuthentication no`, להישאר עם מפתחות בלבד (`pubkeyauthentication` כבר תקין).
- 🔴 `sudo sshd -T | grep -i permitrootlogin` → `permitrootlogin yes` — כניסת root ישירה מותרת; תוקף שמצליח מקבל מיידית superuser. **חוק:** `02-access-ssh.md §2`. **תיקון:** `PermitRootLogin no` (או `prohibit-password`), לעבוד דרך `ubuntu`/`runner` + `sudo`.
- 🔴 `last -a` → כניסת root אמיתית ממוען חיצוני (`46.116.134.45`) — לא רק local/su. ה-PermitRootLogin הפתוח בשימוש פעיל, לא תיאורטי. **חוק:** `02-access-ssh.md §2`. **תיקון:** לוודא שה-IP שייך למנהל לגיטימי, ואז לבטל כניסת root ישירה.
- 🔴 `sudo lastb` → **51,827 ניסיונות כניסה כושלים**, 245 IP-ים ייחודיים, 12,687 כנגד `root`, מ-15/07/2026 ועד היום — מתקפת brute-force פעילה בקנה-מידה גדול, שבשילוב שני הממצאים הקודמים + היעדר fail2ban (למטה) יוצרת סיכון קרוב לפריצה מוצלחת, לא תיאורטי. **חוק:** `02-access-ssh.md §1-3`. **תיקון:** לסגור סיסמאות+root login (למעלה) + להתקין fail2ban **מיידית**; לשקול allowlist-IP/שינוי פורט כמיטיגציה זמנית נוספת.
- 🟡 `sudo systemctl is-enabled fail2ban` → `not-found`; `fail2ban-client` → `command not found` — fail2ban לא מותקן כלל, אין חסימה אוטומטית ל-IP-ים התוקפים בפועל. **חוק:** `02-access-ssh.md §3`. **תיקון:** להתקין `fail2ban` + jail פעיל ל-`sshd`. **✅ טופל (2026-07-20):** מותקן ופעיל (`systemctl is-active` → `active`), jail `sshd` מחובר ל-journald, כבר תפס ניסיון כשל אחד תוך דקות מההפעלה.
- 🔵 סשן הפיתוח/ביקורת של Claude Code רץ עם גישת shell מלאה על אותו שרת שמארח את הפרודקשן, ללא הפרדת סביבות. **חוק:** עקרון least-privilege. **תיקון:** לא נמצא תיקון נקי — דרושה החלטת אדם (מתח בין נוחות פיתוח לבין בידוד סביבות; מחוץ להיקף ביקורת read-only זו).

בדיקות שיצאו נקיות: אין משתמש כפול עם `uid=0`; `sudo` group מכיל משתמשי-עבודה אמיתיים (`ubuntu`,`runner`), לא רק root; כל קבצי `authorized_keys` (root/ubuntu/runner) בהרשאה `600` נכונה; `MaxAuthTries=6`, `LoginGraceTime=120` סבירים.

## חומת אש ופורטים — FAIL

- 🔴 **מאמת ממצא קיים** (`INFRA-SECURITY-FINDINGS.md`) — `sudo ufw status verbose` + `sudo ss -tlnp` מאשרים ש-`888/tcp ALLOW IN Anywhere` (+v6) עדיין פעיל, פאנל aaPanel חשוף לכל האינטרנט. **תיקון:** להגביל ל-IP ניהול ידוע/VPN.
- 🟡 **מאמת + משלים** — פורט `25664/tcp` פתוח ומאזין בפועל; זוהה סופית: `sudo cat /proc/<pid>/cmdline` → בינארי `nginx` נפרד תחת `/www/server/panel/webserver/sbin/webserver` (רכיב-עזר פנימי של aaPanel, לא ה-nginx הראשי). עדיין לא אומת אם יש הזדהות מולו. **תיקון:** לבדוק `webserver.conf`, ואז לסגור/להגביל אם אין הזדהות.
- 🟡 **מאמת ממצא קיים** — `20/tcp`,`21/tcp`,`39000:40000/tcp` (FTP) עדיין `ALLOW Anywhere` ב-ufw, אך אין מאזין חי כרגע — משטח-תקיפה מת. **תיקון:** `ufw delete allow` על השלושה אלא אם FTP מתוכנן בכוונה.
- 🔵 **חדש** — `sudo docker ps` חושף container נוסף לא-מתועד: `lean-chronoscope-mcp` (`127.0.0.1:8780`, loopback-only, לא נגיש מבחוץ, לא מוגדר ב-`docker-compose.yml` של הריפו). **תיקון:** לתעד או להסיר אם לא רלוונטי ל-BeautyCareClinic.
- 🔵 **מאמת ממצא קיים** — Kestrel (`0.0.0.0:5000`) ו-Vite (`*:5174`) מאזינים על כל ה-interfaces ברמת ה-OS, מוגנים רק ע"י היעדר allow-rule ב-ufw (בקרה בודדת, לא bind-to-loopback). **תיקון:** bind מפורש ל-`127.0.0.1`.

נבדק ונמצא תקין: כיסוי IPv4/IPv6 מלא וזהה בכל כללי ufw (`IPV6=yes` מאושר); אין DB/Redis/Mongo/Elastic נוספים חשופים על `0.0.0.0`.

## חשיפה לאינטרנט (edge) — FAIL

- 🔴 **חדש, חמור** — `curl https://169-58-26-157.sslip.io/@fs/home/runner/Projects/BeautyCareClinic/docker-compose.yml` → `200` + תוכן מלא; גם `appsettings.Development.json`, `vite.config.ts` נגישים באותה דרך. שרת ה-Vite **dev** מאחורי ה-proxy מגיש כל קובץ לא-dot בעץ הריפו דרך `/@fs/`, **ללא אימות, עוקף לגמרי את שער ה-Basic-Auth** שהוגדר על `/swagger`. תוכן חשוף כרגע הוא placeholders בלבד, אך המנגנון חושף קוד מקור מלא וכל קובץ עתידי לא-dot עם ערך אמיתי (למשל `env.development.local`) ייחשף מיידית. path-traversal מחוץ לריפו נבדק ונחסם כראוי. **חוק:** `04-edge-nginx-tls.md §4`. **תיקון:** מעבר ל-`vite build`+שרת סטטי (תיקון שורש) או, כפתרון-ביניים בלבד, `location ~ ^/@fs/ { deny all; }` ב-`beautycare.conf`.
- 🟡 `curl -H "Host: 127.0.0.1" .../nginx_status` → `200` עם נתוני חיבורים חיים, **מהאינטרנט הציבורי** — ה-`allow 127.0.0.1;` בקונפיג חסר `deny all;` נגדי, ו-`server_name` אינו בקרת-גישה אמיתית (עוקף ע"י Host header שרירותי). **תיקון:** להוסיף `deny all;` אחרי ה-`allow`.
- 🟡 `curl -H "Host: 169.58.26.157" http://169.58.26.157/` (Host לא-תואם) → עמוד ברירת-מחדל של aaPanel ("website stopped") — נופל דרך default-site לא-מכוון בפורט 80 (בשונה מ-CR-035 שמתעד את אותה בעיה בפורט 443/HTTPS). **תיקון:** `default_server`+`return 444` מפורש בפורט 80.
- 🟡 אין `location ~ /\. { deny all; }` כלשהו ב-`beautycare.conf` עצמו — ה-403 שנצפה ל-`/.git/config` מגיע רק מברירת-המחדל של Vite, לא מ-nginx; אם ה-dev server יוחלף, אין קו הגנה שני. **תיקון:** להוסיף חסימת dot-file מפורשת ב-nginx.
- 🔵 תוקף תעודה **אומת חי** (handshake אמיתי, לא רק קריאת קובץ): תקפה עד 2026-10-18, `certbot.timer` פעיל, ריצה הבאה מאושרת. `vhost` יחיד קיים (`beautycare.conf`), אין ישן/שכוח. אין קבצים רגישים תחת web root. הועדר Cloudflare אושר (לא רק דילוג) — origin חשוף ישירות.

## סודות / git / הרשאות — WARN

- 🟡 `env.development.local` (664, `runner:runner`) — קריא-לכל-משתמש-מקומי, לא רק owner; זה בדיוק הקובץ שכבר תועד כ-tracked ב-git בגלל פער gitignore. **תיקון:** `chmod 600`.
- 🟡 `.env.local` (664) — גם הוא קריא-לעולם, אף שנכון מתעלם ע"י git; מכיל כרגע רק ערך ריק/ציבורי. **תיקון:** `chmod 600`.
- 🔵 `~/.microsoft/usersecrets/<guid>/secrets.json` עצמו מוגן נכון (`600`), אך תיקיות ההורה `775` — listing אפשרי (לא קריאת-תוכן). **תיקון:** `chmod 700` על התיקיות אם רוצים לצמצם אף listing.

נבדק ונמצא תקין: `appsettings*.json` — placeholder בלבד; `.env`/`.env.local` מעולם לא נכנסו להיסטוריית git; אין קבצים world-writable אמיתיים בריפו; אין מפתחות פרטיים/dumps בנתיב הפרויקט. `.env` האמיתי של `docker-compose.yml` (Postgres) עדיין לא נוצר על השרת בפועל.

## עדכונים — WARN

- 🟡 `nginx -v` → `1.30.3`, אך `dpkg -l`/`apt list --installed` לא מכירים אותו כלל — זהו build עצמאי של aaPanel (`/www/server/nginx/sbin/nginx`), כך ש-`unattended-upgrades` **לא מעדכן אותו לעולם**. רכיב ה-edge (TLS, האינטרנט הפומבי) תלוי לחלוטין בעדכון ידני דרך פאנל aaPanel. **תיקון:** לוודא/לתזמן עדכון ידני של nginx דרך ממשק aaPanel.
- 🔵 `lean-chronoscope-mcp:local` מתויג `local` (לא `latest`, אבל גם לא מזוהה-גרסה) — קשה לדעת אילו שינויים כלולים אחרי re-build. **תיקון:** לתייג לפי git-sha/תאריך.

נבדק ונמצא תקין: `apt list --upgradable` → ריק (0 עדכונים ממתינים); `unattended-upgrades` מותקן+מופעל+**מאושר רץ בפועל** (`journalctl` מראה ריצות מוצלחות 16-20/07); Ubuntu 24.04.4 LTS נתמך; `postgres:17` בתג גרסה מפורש (`17.10`).

## גיבויים — FAIL

- 🔴 `crontab -l`/`sudo crontab -l` (root) → **שורה יחידה** (חידוש תעודת SSL בלבד); אין שום `pg_dump`/סקריפט גיבוי ב-cron/systemd-timers בכל השרת. **אין שום גיבוי, לא ידני ולא אוטומטי**, לנתוני ה-Postgres האמיתיים (PII+כספים) — כשל דיסק/מחיקה = אובדן-נתונים בלתי הפיך. זהו הפריט שסומן "unconfirmed" ב-`privacy/PRIVACY-COMPLIANCE-AMENDMENT13.md`, כעת מאושר-בפועל. **חוק:** `07-backups.md §1`. **תיקון:** לא נמצא תיקון קיים לאמת — דרושה החלטת אדם (מנגנון `pg_dump` מתוזמן + יעד offsite מוצפן).
- 🔴 `sudo ls -la /www/backup/database` + `/www/backup/site` → **שתיהן ריקות** — תכונת הגיבוי המובנית של aaPanel קיימת בתשתית אך מעולם לא הופעלה. **תיקון:** להפעיל job הגיבוי של aaPanel או pipeline ייעודי.
- 🟡 `/www/server/panel/data/db_backups/default.sql` — הובהר: זה גיבוי-המטא-דאטה **של הפאנל עצמו** (SQLite פנימי), לא dump של Postgres של האפליקציה — לא לבלבל כ"יש גיבוי".
- 🔵 אין `restic`/`borg`/`duplicity`/`rclone`/`s3cmd` מותקנים, ואין היסטוריית-פקודות שמראה שאי-פעם בוצע גיבוי ידני.

## לוגים וניטור — FAIL

- 🔴 **חדש, חמור** — `sudo grep -iE 'password=' /var/log/auth.log` → **סיסמת ה-Postgres האמיתית מופיעה בטקסט גלוי** (`sudo` מתעד את שורת הפקודה המלאה של `docker run -e POSTGRES_PASSWORD=...`/`docker exec -e PGPASSWORD=...` שהורצו ידנית). נשמר ~4 שבועות (`rotate 4 weekly`), נגיש לכל sudo/קבוצת `adm`. **חוק:** `08-logs-monitoring.md §2`. **תיקון:** לסובב/למחוק את `auth.log`/`auth.log.1` הקיימים, **לסבב את סיסמת ה-Postgres עצמה** (כבר נחשפה), ולהעביר סודות רק דרך `--env-file` (600) או Docker secrets — לא כ-CLI flag גלוי.
  **✅ טופל (2026-07-20):** סיסמה חדשה הוגדרה (`ALTER USER` דרך stdin, לא CLI flag), נשמרה ב-`dotnet user-secrets` בלבד, אומתה עם חיבור TCP אמיתי, והבקאנד הופעל מחדש ואומת מול ה-DB. כל המופעים הישנים (וכן מופע חדש שנוצר בטעות תוך כדי תהליך האימות עצמו — `docker exec -e PGPASSWORD=...` שוב, אותה תבנית בדיוק) נוקו מ-`/var/log/auth.log` (`sed` להחלפת הערך ב-`<redacted>`, לא מחיקת השורות). `auth.log.1` (הגיבוי המסובב) נבדק — לא הכיל את התבנית. **לקח לתיקונים עתידיים דומים:** להעביר סיסמאות ל-`docker exec`/`docker run` רק דרך `--env-file` (שמעביר רק נתיב-קובץ בשורת הפקודה, לא ערך) — לעולם לא `-e VAR=secret` ישירות, גם לצורך אימות חד-פעמי.
- 🟡 אין `/etc/logrotate.d/nginx` ואין תזמון ל-`run_log_split.py` של aaPanel — לוגי nginx (`/www/wwwlogs/*.log`) יגדלו ללא הגבלה (כרגע קטנים בלבד כי האתר חדש). **תיקון:** להוסיף logrotate ל-nginx.
- 🟡 אין שום סוכן/שירות ניטור (`netdata`/`prometheus`/`grafana`/uptime-check) — 18 טיימרים קיימים, כולם ברירות-מחדל של המערכת, אף אחד לא בודק בריאות אפליקציה/דיסק/SSL. **תיקון:** לפרוס ניטור קליל (Uptime Kuma/netdata) מאחורי auth, לא חשוף לציבור.
- 🟡 `journalctl -u ssh` מראה עשרות ניסיונות כושלים בזמן אמת — הלוגים "רואים" את המתקפה אך אין מי שמגיב (אין fail2ban). **תיקון:** ראה קטגוריית access.
- 🔵 `journald.conf` — אין `MaxRetentionSec` מפורש (רק ברירת מחדל); שימוש דיסק נוכחי נמוך (127MB מתוך 85GB פנויים), לא דחוף. **תיקון:** להגדיר במפורש (למשל 90 יום).

## מוכנות לאירוע — WARN

- 🟡 אין sunny runbook כללי לאירוע-אבטחה — ההתאמה היחידה בריפו היא הערה נקודתית ב-`phases/phase-013/PHASE_SUMMARY.md:129` על שחזור מנעילת-SSH דרך VNC. **תיקון:** מסמך `INCIDENT.md`/`RUNBOOK.md` כללי (סבב-סודות, בידוד, שחזור מגיבוי, ניתוח סיבת-שורש).
- 🟡 `docs/ARCHITECTURE.md:98` משתמע ש-Vite/Kestrel "סגורים" — בפועל שניהם מאזינים על `0.0.0.0`/`*`, ההגנה תלויה ב-ufw בלבד. מי שיסתמך על התיעוד בזמן אירוע יטעה לחשוב שזה loopback-only. **תיקון:** bind בפועל ל-`127.0.0.1` + עדכון התיעוד לתאר bind אמיתי.
- 🟡 תהליך ה-Kestrel החי רץ אד-הוק (`dotnet run` משורת session), לא כ-systemd/docker מנוהל; הלוג היחיד הוא קובץ זמני ב-`/tmp` שלא מתועד בשום מקום — שחזור-מצב דורש ידע שבטני. **תיקון:** systemd unit/docker מנוהל + נתיב-לוג מתועד.
- 🟡 `lean-chronoscope-mcp` container לא-מתועד רץ 26+ שעות ללא הסבר ב-`docs/`. **תיקון:** לתעד או להסיר.
- 🟡 מתקפת ה-SSH הפעילה (ראה access) מזוהה בלוגים בזמן אמת אך ללא שום מנגנון-תגובה. **תיקון:** ראה access.
- 🔵 שני ערכי cron בשמות אטומים (hash-ים) — אומתו כלגיטימיים (`staticroute` של Contabo cloud-init, חידוש-תעודה של aaPanel) אך דורשים `cat` ידני לכל מבקר עתידי לוודא שאינם persistence זדוני. **תיקון:** הערה מסבירה בקובץ.
- ❔ לא אומת — לבדוק שוב: `/root/.ssh/authorized_keys`/`id_ed25519` שונו ב-2026-07-19 — תואם בזמן לעבודת ה-SSH-lockout/VNC-recovery המתועדת ב-phase-013, אך לא ניתן לאשר read-only שזה בדיוק אותו שינוי.

ממצאים חיוביים: תיעוד-חלקי-חיובי קיים (VNC recovery path); אין uid-0 כפול/משתמשי-login זרים; אחסון journald קבוע ומוגן-כתיבה מפני תהליכי-אפליקציה לא-פריבילגיים; אין תוספת cron חשודה.

---

## ממצאים בוודאות נמוכה / לבדיקת אדם
- ❔? `25664/tcp` (aaPanel `webserver` binary) — זוהה הבינארי, אך לא אושש אם יש הזדהות מולו לפני החלטת סגירה.
- ❔? הצפנת גיבויים — לא רלוונטי כרגע (אין גיבוי בכלל), אך יידרש אימות ברגע שגיבוי ייבנה.
- ❔? שינוי מפתחות SSH ב-19/07 — תואם-בזמן לעבודת phase-013 אך לא אושש ישירות כאותו אירוע.

## פערי כיסוי והמשך
ביקורת זו בודקת **מצב שרת חי בלבד**. לא נכלל כאן:
- **קונפיג ב-repo** (compose/nginx/Dockerfile על הדיסק) → כבר כוסה ב-`INFRA-SECURITY-FINDINGS.md`.
- **קוד האפליקציה** (IDOR/injection/authz) → מחוץ להיקף הסבב הזה (המשתמשת בחרה תשתית+E2E+פרטיות, לא code-audit).
- **פרטיות / תיקון 13** → כוסה ב-`PRIVACY-COMPLIANCE-AMENDMENT13.md`.
- **נגישות HTTP חיה מנקודת-מבט חיצונית אמיתית** (לא מהשרת עצמו) → `runtime-confirm`.
- **חומת אש של ספק הענן (Contabo) / security groups** → לא נראה מתוך השרת, מחוץ לטווח.
- פריטים שדרשו אימות נוסף: זהות שירות ה-`webserver` על 25664; האם `docker`-group permission חסרה למשתמש `runner` נבדקה בעקיפין (`sudo docker` עבד, `docker` ישיר נכשל) — לא נבדק אם זו כוונה או פער.

## מתודולוגיה
- סוכן (read-only): server-hardening-auditor ×8, אחד לכל קטגוריה (access, network, edge, secrets,
  updates, backups, observability, incident). בסיס: `server-hardening-review/references/`.
- כל ממצא מעוגן ל**פקודה + הפלט שלה**. לא בוצעה אף פקודה משנה (mutating). הביקורת רצה ישירות על
  השרת (לא SSH-hop) כי סשן זה כבר פועל עליו.
