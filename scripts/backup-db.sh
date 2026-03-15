#!/bin/bash
# =============================================================================
# QRくるくる診断DX - 総合バックアップスクリプト
#
# 毎日午前3時にcronで実行される
# バックアップ内容:
#   DB / アップロード画像 / .env / Git情報 / サーバー設定
#   SSL証明書 / crontab / PostgreSQL設定 / ファイアウォール設定
#
# crontab設定:
#   0 3 * * * /root/backup_dental.sh
#
# 注意: PGPASSWORD はこのスクリプト内で設定（本番サーバーのみ使用）
# =============================================================================

BACKUP_DIR=~/backups
export PGPASSWORD="__PGPASSWORD__"
KEEP_DAYS=7
DATE=$(date +%Y%m%d_%H%M%S)
TARGET=$BACKUP_DIR/$DATE
LOG=$BACKUP_DIR/backup.log
mkdir -p $TARGET

# ---------- 1. データベースバックアップ ----------
pg_dump -h localhost -U dental_user -d dental_check -F c -Z 9 -f $TARGET/database.dump 2>> $LOG
if [ $? -ne 0 ]; then
  echo "[$DATE] ERROR: Database dump failed" >> $LOG
  exit 1
fi
DUMP_SIZE=$(stat -c%s "$TARGET/database.dump" 2>/dev/null || echo 0)
if [ "$DUMP_SIZE" -lt 1024 ]; then
  echo "[$DATE] ERROR: Database dump too small" >> $LOG
  exit 1
fi

# ---------- 2. アップロード画像バックアップ ----------
if [ -d /var/www/qlql/public/uploads ]; then
  tar czf $TARGET/uploads.tar.gz -C /var/www/qlql/public uploads 2>/dev/null
fi

# ---------- 3. 設定ファイル・Git情報バックアップ ----------
cp /var/www/qlql/.env $TARGET/env_backup 2>/dev/null

cd /var/www/qlql
git log --oneline -1 > $TARGET/git_commit.txt
git diff > $TARGET/local_changes.patch 2>/dev/null

mkdir -p $TARGET/server_config
cp /etc/nginx/sites-available/qlql $TARGET/server_config/ 2>/dev/null
cp /etc/nginx/sites-enabled/qlql $TARGET/server_config/ 2>/dev/null
pm2 save 2>/dev/null && cp ~/.pm2/dump.pm2 $TARGET/server_config/ 2>/dev/null
cp ~/backup_dental.sh $TARGET/server_config/ 2>/dev/null

# ---------- 4. SSL証明書バックアップ ----------
# Let's Encrypt の証明書ファイルをバックアップ
# サーバーが壊れたときに certbot の再発行なしで復旧できる
if [ -d /etc/letsencrypt ]; then
  mkdir -p $TARGET/ssl
  tar czf $TARGET/ssl/letsencrypt.tar.gz -C /etc letsencrypt 2>/dev/null
fi

# ---------- 5. crontab バックアップ ----------
# 定期実行の設定を保存（このスクリプト自体の登録内容など）
crontab -l > $TARGET/server_config/crontab.txt 2>/dev/null

# ---------- 6. PostgreSQL設定バックアップ ----------
# DB接続の認証設定やチューニング設定を保存
mkdir -p $TARGET/server_config/postgresql
PG_CONF_DIR=$(pg_config --sysconfdir 2>/dev/null || echo "/etc/postgresql")
# 主要な設定ファイルを探してコピー
for conf_file in pg_hba.conf postgresql.conf; do
  found=$(find /etc/postgresql -name "$conf_file" 2>/dev/null | head -1)
  if [ -n "$found" ]; then
    cp "$found" $TARGET/server_config/postgresql/ 2>/dev/null
  fi
done

# ---------- 7. ファイアウォール設定バックアップ ----------
# どのポートを開放しているかの設定を保存
if command -v ufw > /dev/null 2>&1; then
  ufw status verbose > $TARGET/server_config/ufw_rules.txt 2>/dev/null
fi

# ---------- 8. サイズ計測（★フォルダ削除の前に実行する） ----------
UPLOAD_SIZE=$(stat -c%s "$TARGET/uploads.tar.gz" 2>/dev/null || echo 0)

# ---------- 9. 圧縮・クリーンアップ ----------
cd $BACKUP_DIR
tar czf ${DATE}.tar.gz $DATE && rm -rf $DATE
find $BACKUP_DIR -maxdepth 1 -name "*.tar.gz" -mtime +$KEEP_DAYS -delete

# ---------- 10. ディスク容量チェック ----------
AVAIL=$(df /root --output=avail -B1 | tail -1)
if [ "$AVAIL" -lt 2147483648 ]; then
  echo "[$DATE] WARNING: Disk space low" >> $LOG
fi

# ---------- 11. ログ出力 ----------
echo "[$DATE] OK: Backup completed (DB: $(numfmt --to=iec $DUMP_SIZE), Uploads: $(numfmt --to=iec $UPLOAD_SIZE))" >> $LOG
