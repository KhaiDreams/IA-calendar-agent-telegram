#!/bin/bash
# Script de backup da sessão do Baileys (auth_info) para o S3
# Uso: ./scripts/backup-s3.sh
# Deve ser executado via cron na EC2

set -e

BUCKET="baileys-sessions-calendar-agent"
SOURCE_DIR="auth_info"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_NAME="auth_info-$TIMESTAMP.tar.gz"

echo "[Backup] Iniciando backup da sessão..."

# Verifica se o diretório existe
if [ ! -d "$SOURCE_DIR" ]; then
    echo "[Backup] Diretório $SOURCE_DIR não encontrado. Nada a fazer."
    exit 0
fi

# Compacta
tar -czf "/tmp/$BACKUP_NAME" -C "$(dirname "$SOURCE_DIR")" "$(basename "$SOURCE_DIR")"

# Envia pro S3
aws s3 cp "/tmp/$BACKUP_NAME" "s3://$BUCKET/"

# Remove o arquivo temporário
rm -f "/tmp/$BACKUP_NAME"

echo "[Backup] Backup concluído: $BACKUP_NAME"

# Mantém apenas os últimos 7 backups
aws s3 ls "s3://$BUCKET/" | sort -r | tail -n +8 | awk '{print $4}' | while read -r old; do
    aws s3 rm "s3://$BUCKET/$old"
    echo "[Backup] Removido backup antigo: $old"
done

echo "[Backup] Finalizado."