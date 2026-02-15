#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
    CREATE DATABASE codaholiq_test;
    GRANT ALL PRIVILEGES ON DATABASE codaholiq_test TO $POSTGRES_USER;
EOSQL
